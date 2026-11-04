"""Screen payloads: load inputs -> run rules -> shape everything a screen needs. No numbers are produced here
beyond simple counts/means of rule outputs."""
from __future__ import annotations

import collections
import copy
import datetime as _dt
import statistics as st

from sqlmodel import Session, select

from . import rules
from .db import load_state, read_seed
from .models import Decision, PrincipleSelection, SettingOverride, VisionDoc
from .rag.retrieve import togaf_principles
from .rules.common import band, fmt, xp
from .rules.technology import check_explain

DISPOSITIONS = ["Invest", "Tolerate", "Migrate", "Eliminate", "Consolidate", "Retain (out of scope)"]
ACTIONS = ("Migrate", "Eliminate", "Consolidate")
KIND = {"capability": "Capability", "application": "Application", "duplication": "Duplication", "data": "Data",
        "technology": "Technology", "governance": "Governance", "business": "Business", "data_tech": "Data & Technology"}

WHEEL = [  # ADM wheel nodes -> screen
    ("PRELIM", "Preliminary", "vision"), ("A", "A. Architecture Vision", "vision"),
    ("B", "B. Business Architecture", "business"), ("C", "C. Information Systems", "applications"),
    ("D", "D. Technology Architecture", "data_tech"), ("E", "E. Opportunities & Solutions", "roadmap"),
    ("F", "F. Migration Planning", "roadmap"), ("G", "G. Implementation Governance", "roadmap"),
    ("H", "H. Change Management", "roadmap"), ("REQ", "Requirements Management", "roadmap")]
LAYERS = ["Customer & Sales", "Logistics & Operations", "Enterprise Apps", "Admin Apps", "Data & AI"]
HOST_LOC = {"DC-HYD": "L1", "Azure": "L3", "RISE (SAP-managed)": "L4"}


def labels(cfg: dict) -> dict:
    return {d: rules.label(d, cfg) for d in DISPOSITIONS}


def ctx(s: Session) -> tuple[dict, dict]:
    """Inputs and rule outputs. The roadmap (gaps, initiatives, FY budget, total) and the state projections are rebuilt
    from the Business, Application and Data & Technology gap registers; the parity-port roadmap stays in r['parity']."""
    state = load_state(s)
    r = rules.run_all(state, state["acmm"])
    r["parity"] = {k: r[k] for k in ("gaps", "initiatives", "fy_budget", "total_cr", "states")}
    r["registers"] = _registers(s, state, r)
    gov = [g for g in r["gaps"] if g["kind"] == "governance"]
    r["gaps"] = rules.unify_gaps(r["registers"], gov, state["cfg"])
    r["initiatives"], r["fy_budget"], r["total_cr"] = rules.register_roadmap(r["gaps"], state["cfg"])
    r["states"] = rules.architecture_states(r, state)
    return state, r


def _clusters(state: dict, r: dict) -> list[dict]:
    l2 = l2_index(state)
    rows = {a["id"]: a for a in r["app_rows"]}
    name = {a["id"]: a["name"] for a in state["apps"]} | {x["id"]: x["name"] for x in state["external"]}
    return [dict(c, cap_name=l2.get(c["cap"], {}).get("name", c["cap"]),
                 members=[{"id": a, "name": name[a], "disposition": rows[a]["disposition"], "label": rows[a]["label"]} for a in c["apps"]],
                 survivor_name=name[c["survivor"]]) for c in r["clusters"]]


def _registers(s: Session, state: dict, r: dict) -> dict:
    """The three gap registers, built once per request and shared by their screens and the roadmap."""
    cfg = state["cfg"]
    notes = {k: (o.value if (o := s.get(SettingOverride, k)) else {}) for k in ("gap_notes", "app_gap_notes", "dt_gap_notes")}
    app_names = {a["id"]: short(a["name"]) for a in state["apps"]}
    biz = rules.gap_register(state["caps"], state["surveys"], cfg, app_names, notes["gap_notes"])
    integ = r["integration"]
    health = rules.tech_health(state["apps"], state["surveys"], integ["degree"], integ["hotspot_min"], cfg)
    cap_tree = _app_cap_tree(state, r)
    app_ref = ref_view(state, "APP-REF", r)
    app = rules.application_gaps(state["apps"], r["app_rows"], _clusters(state, r), health,
                                 [c for l1 in cap_tree["l1"] for c in l1["children"]], integ, app_ref, labels(cfg), cfg, notes["app_gap_notes"])
    eng = state["tech"].get("engineering_checks", [])
    refs = [v for v in (ref_view(state, "DATA-REF", r), ref_view(state, "INFRA-REF", r)) if v]
    dt = rules.data_tech_gaps(state["data"], r["data_rows"], state["tech"]["resilience_checks"], eng, state["tech"]["platforms"],
                              refs, state["tech"].get("landing_zones", []), cfg, notes["dt_gap_notes"], state["tech"].get("cyber"))
    return {"business": biz, "application": app, "data_tech": dt, "health": health, "cap_tree": cap_tree, "app_ref": app_ref}


def l2_index(state: dict) -> dict:
    return {c["id"]: {"id": c["id"], "name": c["name"], "l1": l1["name"]}
            for l1 in state["caps"]["capabilities"] for c in l1["children"]}


def _non_assumed_share(items: list[dict]) -> float:
    return sum(i.get("source", "assumed") != "assumed" for i in items) / max(1, len(items))


def short(n: str) -> str:
    return n.split(" (")[0]


# --------------------------------------------------------------------------- explanations for aggregates
def xline(item: dict, label: str) -> str:
    return next((ln["value"] for ln in item["explain"]["lines"] if ln["label"] == label), "")


def cap_avg_xp(r: dict) -> dict:
    rows = r["cap_rows"]
    by_l1 = collections.defaultdict(list)
    for c in rows:
        by_l1[c["l1"]].append(c["maturity"])
    bands = collections.Counter(c["band"] for c in rows)
    lines = [(l1, f"mean of {len(v)} L2 = {st.mean(v):.2f}") for l1, v in by_l1.items()]
    lines.append(("Bands", ", ".join(f"{k} {bands[k]}" for k in ("strong", "developing", "weak", "critical"))))
    return xp("Average capability maturity", lines,
              f"Mean of {len(rows)} L2 maturities = {sum(c['maturity'] for c in rows):.2f} / {len(rows)} = "
              f"{st.mean(c['maturity'] for c in rows):.2f}",
              "Each L2 maturity = mean(process, technology & AI, data, integration), scored 1-5", "§8.4, §32")


def data_avg_xp(r: dict) -> dict:
    rows = r["data_rows"]
    return xp("Average data-domain score", [(f"{d['id']} {d['name'][:40]}", f"{d['score']} ({d['band']})") for d in rows],
              f"Mean = {sum(d['score'] for d in rows)} / {len(rows)} = {st.mean(d['score'] for d in rows):.1f} → "
              f"{round(st.mean(d['score'] for d in rows))}",
              "Domain score = owner 20 + SoR 10 + MDM 20 + quality 30 + lineage 10 + classified-if-PII 10",
              "§23.6.2, §35.6.4")


def total_xp(r: dict) -> dict:
    return xp("Roadmap investment", [(f"{i['wave_id']} {i['id']} {i['name'][:38]}",
                                      f"{i['size']} → ₹{fmt(i['cost_cr'][0])}–{fmt(i['cost_cr'][1])} Cr")
                                     for i in r["initiatives"]],
              f"Sum = ₹{fmt(r['total_cr'][0])}–{fmt(r['total_cr'][1])} Cr",
              "Each initiative costs its size band on the rate card. Indicative, not a quote.", "§28, §36.2.14")


def disp_xp(r: dict, cfg: dict) -> dict:
    L = labels(cfg)
    by = collections.defaultdict(list)
    for a in r["app_rows"]:
        by[a["disposition"]].append(a["id"])
    rules_on = [x["id"] for x in cfg["rationalization"].get("rules", []) if x.get("enabled")]
    return xp("Application dispositions", [(L[d], f"{len(by[d])}: {', '.join(by[d]) or '–'}") for d in DISPOSITIONS if by[d] or d != "Consolidate"],
              f"{len(r['app_rows'])} applications classified",
              f"BF and TF vs threshold {fmt(cfg['rationalization']['threshold'])} → quadrant, then rules {', '.join(rules_on)}; "
              "manual overrides keep their reason", "§28.2, §35.6.5")


def fy_xp(r: dict) -> dict:
    lines = []
    for y, (lo, hi) in r["fy_budget"].items():
        parts = [f"{i['id']} {fmt(round(i['fy_split'][y][0], 2))}–{fmt(round(i['fy_split'][y][1], 2))}"
                 for i in r["initiatives"] if y in i["fy_split"]]
        lines.append((f"{y}: ₹{lo:.1f}–{hi:.1f} Cr", " + ".join(parts)))
    return xp("Budget by financial year", lines, f"Total ₹{fmt(r['total_cr'][0])}–{fmt(r['total_cr'][1])} Cr",
              "Each initiative's rate-card band is split across FYs by its wave: W0 50/50 FY27-FY28, W1 FY28, W2 FY29, W3 FY30",
              "§28, §36.2.14")


def principles_view(s: Session, state: dict) -> dict:
    adopted = {p.id for p in s.exec(select(PrincipleSelection)) if p.adopted}
    togaf = [dict(p, adopted=p["id"] in adopted) for p in togaf_principles()]
    cil = [dict(p, adopted=p["id"] in adopted, citation=None) for p in state["vision"]["principles_cil"]]
    lim = state["cfg"]["governance"]["principles_limit"]
    n = sum(p["adopted"] for p in togaf + cil)
    warn = None
    if n < lim["min"]:
        warn = f"{n} adopted: TOGAF §{lim['ref']} suggests at least {lim['min']}"
    elif n > lim["max"]:
        warn = f"{n} adopted: TOGAF §{lim['ref']} suggests no more than {lim['max']}"
    return {"togaf": togaf, "cil": cil, "adopted": n, "limit": lim, "warning": warn}


def vision_doc(s: Session) -> dict:
    v = s.get(VisionDoc, 1) or VisionDoc(id=1)
    return {"vision_statement": v.vision_statement, "ai_ambition": v.ai_ambition, "objectives": v.objectives or [],
            "success_measures": v.success_measures or [], "citations": v.citations or [], "source": v.source,
            "mode": v.mode, "updated": v.updated.isoformat() if v.updated else None}


def rules_config(cfg: dict) -> dict:
    rc, cr = cfg["rationalization"], cfg["capability_rules"]
    return {"threshold": rc["threshold"], "bf_weights": rc.get("bf_weights", [1, 1, 1]),
            "tf_weights": rc.get("tf_weights", [1, 1, 1, 1]), "labels": rc.get("labels", {}),
            "rules": [dict(x, condition=rc.get("conditions", {}).get(x["when"], x["when"])) for x in rc.get("rules", [])],
            "capability": {"gap_importance_min": cr.get("gap_importance_min", 4), "gap_maturity_max": cr.get("gap_maturity_max", 2.5),
                           "target_maturity": cr.get("target_maturity", {})},
            "defaults": {"threshold": read_seed()["cfg"]["rationalization"]["threshold"]}}


# --------------------------------------------------------------------------- overview
def _views_index(state: dict, r: dict) -> list:
    caps_all = [c for l1 in state["caps"]["capabilities"] for c in l1["children"]]
    tech = state["tech"]
    recs = {  # view -> records behind it (provenance share)
        "landscape": state["apps"] + state["data"] + tech["platforms"], "heatmap": caps_all,
        "architecture": state["apps"], "interaction": state["integrations"], "integration": state["integrations"],
        "data_arch": state["data"], "platform": tech["platforms"], "network": tech.get("network", []),
        "cloud": state["apps"], "security": tech["resilience_checks"], "standards": tech["platforms"],
        "guardrails": state["vision"]["principles_cil"] + state["vision"]["guardrails"],
        "states": caps_all + state["apps"], "models": state["process_models"],
    }
    out = []
    for v in state["cfg"].get("architecture_views", []):
        items = recs.get(v["view"], [])
        share = _non_assumed_share(items) if items else 0
        out.append(dict(v, records=len(items), evidence=round(100 * share),
                        status="evidenced" if share >= 0.5 else "draft"))
    return out


def _landscape(state: dict, r: dict) -> dict:
    cfg = state["cfg"]
    L = labels(cfg)
    rows = {c["id"]: c for c in r["cap_rows"]}
    rowa = {a["id"]: a for a in r["app_rows"]}
    l1s = []
    for l1 in state["caps"]["capabilities"]:
        ms = [rows[c["id"]]["maturity"] for c in l1["children"] if c["id"] in rows]
        m = round(st.mean(ms), 2) if ms else None
        l1s.append({"id": l1["id"], "name": l1["name"], "l0": l1.get("l0"), "maturity": m,
                    "band": band(m, cfg["capability_rules"]["heat_bands"]) if m is not None else None,
                    "gaps": sum(rows[c["id"]]["is_gap"] for c in l1["children"] if c["id"] in rows)})
    layers = [{"layer": ly, "apps": [{"id": a["id"], "name": a["name"], "disposition": rowa[a["id"]]["disposition"],
                                      "label": L.get(rowa[a["id"]]["disposition"], rowa[a["id"]]["disposition"]),
                                      "hosting": a["hosting"], "in_scope": a["in_scope"]}
                                     for a in state["apps"] if a.get("layer", "Enterprise Apps") == ly]} for ly in LAYERS]
    hosting = collections.Counter(a["hosting"] for a in state["apps"])
    return {"l0": [{"id": x["id"], "name": x["name"]} for x in state["caps"].get("l0", [])], "l1": l1s, "layers": layers,
            "data": [{"id": d["id"], "name": short(d["name"]), "score": d["score"], "band": d["band"]} for d in r["data_rows"]],
            "hosting": [{"name": h, "apps": n} for h, n in hosting.most_common()],
            "platforms": [{"id": p["id"], "name": p["name"], "category": p["category"], "standard": p["standard"]}
                          for p in state["tech"]["platforms"]]}


def _pct_band(p: float | None) -> str | None:
    return None if p is None else "strong" if p >= 70 else "developing" if p >= 50 else "weak" if p >= 30 else "critical"


def _overview_health(state: dict, r: dict) -> tuple[dict, list[dict], dict]:
    """Engagement status, one health line per architecture domain and the IT cost headline for the dashboard."""
    cfg = state["cfg"]
    p = engagement_plan(state["vision"], state["plan_status"])
    wk = p.get("current_week", 1)
    cur = next((ph for ph in p.get("phases", []) if ph["start_week"] <= wk <= ph["end_week"] and ph["progress"] < 100), None)
    mss = [a for ph in p.get("phases", []) for a in ph["activities"] if a["status"] == "milestone" and a["start_week"] >= wk]
    steer = [w for w in (p.get("cadence") or {}).get("steerco", []) if w >= wk]
    eng = {"week": wk, "weeks": p.get("weeks", 16), "progress": p.get("progress", 0), "phase": cur["name"] if cur else None,
           "phase_weeks": f"W{cur['start_week']}–W{cur['end_week']}" if cur else None,
           "milestone": {"name": mss[0]["name"], "week": mss[0]["start_week"]} if mss else None,
           "steerco": steer[0] if steer else None, "counts": p.get("counts", {})}
    th = rules.tech_health(state["apps"], state["surveys"], r["integration"]["degree"], r["integration"]["hotspot_min"], cfg)
    eng_s = rules.engineering_score(state["tech"].get("engineering_checks", []), cfg)
    bv = budget_view(state, r)
    caps = r["cap_rows"]
    avg_cap = st.mean(c["maturity"] for c in caps) if caps else 0
    by_l1 = collections.defaultdict(list)
    for c in caps:
        by_l1[c["l1"]].append(c["maturity"])
    weakest = min(by_l1.items(), key=lambda kv: st.mean(kv[1]))[0] if by_l1 else "–"
    action = [a for a in r["app_rows"] if a["disposition"] in ACTIONS]
    inscope = [a for a in r["app_rows"] if a["disposition"] != "Retain (out of scope)"]
    data_avg = st.mean(d["score"] for d in r["data_rows"]) if r["data_rows"] else 0
    risk = sum(d["privacy_risk"] for d in r["data_rows"])
    checks = state["tech"]["resilience_checks"]
    lt = bv["latest"]
    lo, hi = bv["benchmark"]
    health = [
        {"key": "business", "label": "Business capabilities", "screen": "business", "value": f"{avg_cap:.2f} / 5", "pct": round(avg_cap / 5 * 100),
         "note": f"{sum(c['is_gap'] for c in caps)} capability gaps; weakest area {weakest}"},
        {"key": "applications", "label": "Application portfolio", "screen": "applications",
         "value": f"{len(inscope) - len(action)} of {len(inscope)} fit", "pct": round(100 * (len(inscope) - len(action)) / max(1, len(inscope))),
         "note": f"{len(action)} to modernise, replace or consolidate; {th['counts']['high_debt']} with high technical debt"},
        {"key": "health", "label": "Technical health", "screen": "applications", "view": "health",
         "value": f"Debt {th['counts']['avg_debt']}/100", "pct": 100 - (th["counts"]["avg_debt"] or 0),
         "note": f"{th['counts']['spof']} single points of failure; {th['counts']['scal_risk']} apps at scalability risk"},
        {"key": "data", "label": "Data governance", "screen": "data_tech", "view": "data", "value": f"{round(data_avg)} / 100", "pct": round(data_avg),
         "note": f"{risk} domains with unclassified personal data; {sum(not d['owner'] for d in state['data'])} without an owner"},
        {"key": "resilience", "label": "Resilience & security", "screen": "data_tech", "view": "tech",
         "value": f"{r['tech']['resilience_score']} / 100", "pct": r["tech"]["resilience_score"],
         "note": f"{sum(c['status'] == 'fail' for c in checks)} failed and {r['tech']['unknown']} unknown checks"},
        {"key": "engineering", "label": "Engineering practices", "screen": "data_tech", "view": "engineering",
         "value": f"{eng_s['score']} / 100", "pct": eng_s["score"],
         "note": f"{eng_s['counts']['fail']} practices not in place; {eng_s['unknown']} to validate"},
        {"key": "governance", "label": "EA governance (ACMM)", "screen": "roadmap", "view": "governance",
         "value": f"{r['gov']['acmm_mean']} / 5", "pct": round(r["gov"]["acmm_mean"] / 5 * 100),
         "note": f"{sum(lv <= 1 for lv in r['gov']['levels'].values())} of {len(r['gov']['levels'])} elements at level 1 or below"},
    ]
    for h in health:
        h["band"] = _pct_band(h["pct"])
    cost = {"fy": lt["fy"], "total": lt["total"], "pct_revenue": lt["pct_revenue"], "benchmark": [lo, hi], "cagr": bv["cagr"],
            "change_share": lt["change_share"], "afford": bv["afford"][:2],
            "health": th["counts"], "engineering": eng_s["score"], "actions": len(action), "in_scope": len(inscope)}
    return eng, health, cost


def overview_insights(o: dict) -> list[dict]:
    e, h, c = o["engagement"], {x["key"]: x for x in o["health"]}, o["cost"]
    weakest = sorted(o["health"], key=lambda x: x["pct"] if x["pct"] is not None else 101)[:2]
    af = c["afford"][1] if len(c["afford"]) > 1 else (c["afford"][0] if c["afford"] else None)
    return [
        {"text": f"Week {e['week']} of {e['weeks']}" + (f", {e['phase']}" if e["phase"] else "") + f"; {e['progress']}% of tasks done"
                 + (f". Next deliverable: {e['milestone']['name']} (W{e['milestone']['week']})." if e["milestone"] else "."), "rule": "work plan"},
        {"text": "Weakest domains: " + "; ".join(f"{x['label']} {x['value']} ({x['note'].split(';')[0]})" for x in weakest) + ".", "rule": "domain health score"},
        {"text": f"{o['counts']['gaps']} gaps roll up into {o['counts']['initiatives']} initiatives; {h['applications']['note'].split(';')[0]}.", "rule": "gap register, dispositions"},
        {"text": f"{c['fy']} IT spend ₹{c['total']} Cr is {c['pct_revenue']}% of revenue (benchmark {c['benchmark'][0]}-{c['benchmark'][1]}%)"
                 + (f"; the {af['fy']} roadmap needs {af['share'][0]}-{af['share'][1]}% of planned capex." if af else "."), "rule": "IT Budget"},
    ]


def overview(s: Session) -> dict:
    state, r = ctx(s)
    cfg = state["cfg"]
    L = labels(cfg)
    pv = principles_view(s, state)
    vd = vision_doc(s)
    n_dec = len(s.exec(select(Decision)).all())
    caps_all = [c for l1 in state["caps"]["capabilities"] for c in l1["children"]]
    lim = cfg["governance"]["principles_limit"]

    def lvl(ok: bool, started: bool = True) -> str:
        return "assessed" if ok else ("in_progress" if started else "not_started")
    caps_share = _non_assumed_share(caps_all)
    c_share = (_non_assumed_share(state["apps"]) + _non_assumed_share(state["data"])) / 2
    d_share = _non_assumed_share(state["tech"]["resilience_checks"])
    status = {
        "PRELIM": lvl(lim["min"] <= pv["adopted"] <= lim["max"]),
        "A": lvl(bool(vd["vision_statement"])),
        "B": lvl(caps_share >= 0.5, bool(caps_all)),
        "C": lvl(c_share >= 0.5, bool(state["apps"])),
        "D": lvl(d_share >= 0.5 and r["tech"]["unknown"] == 0),
        "E": lvl(bool(r["initiatives"])), "F": lvl(False, bool(r["initiatives"])),
        "G": lvl(False, n_dec > 0), "H": lvl(False, False), "REQ": lvl(False, bool(r["gaps"])),
    }
    status_why = {
        "PRELIM": (f"{pv['adopted']} principles adopted", f"Assessed when {lim['min']}-{lim['max']} principles are adopted (§23.6)"),
        "A": ("Vision saved" if vd["vision_statement"] else "No vision statement saved", "Assessed once a vision statement is saved"),
        "B": (f"{caps_share:.0%} of L2 scores validated", "Assessed when ≥ 50% of L2 scores are validated"),
        "C": (f"{c_share:.0%} of apps and data domains validated", "Assessed when ≥ 50% are validated"),
        "D": (f"{d_share:.0%} of checks validated; {r['tech']['unknown']} unknown",
              "Assessed when ≥ 50% are validated and no check is unknown"),
        "E": (f"{len(r['initiatives'])} initiatives derived from gaps", "Assessed once gaps roll up into initiatives"),
        "F": ("Rate card is indicative", "Stays in progress until the budget is validated with finance"),
        "G": (f"{n_dec} decisions in the log", "In progress once the ARB logs decisions"),
        "H": ("No change requests captured", "Not started until architecture change requests are tracked"),
        "REQ": (f"{len(r['gaps'])} gaps in the register", "In progress while gaps are open"),
    }
    adm_xp = {p: xp(lbl, [("Evidence", status_why[p][0]), ("Opens", scr.replace("_", " & "))],
                    {"assessed": "Assessed", "in_progress": "In progress", "not_started": "Not started"}[status[p]],
                    status_why[p][1]) for p, lbl, scr in WHEEL}
    disp = collections.Counter(a["disposition"] for a in r["app_rows"])
    waves = []
    for w_i, w in enumerate(cfg["roadmap"]["waves"]):
        ins = [i for i in r["initiatives"] if i["wave"] == w_i]
        waves.append({**{k: w[k] for k in ("id", "name", "window")},
                      "initiatives": [{k: i[k] for k in ("id", "name", "size", "cost_cr", "priority")} for i in ins],
                      "cost_cr": [sum(i["cost_cr"][0] for i in ins), sum(i["cost_cr"][1] for i in ins)]})
    top = sorted(r["gaps"], key=lambda g: -g["priority"])[:5]
    adopted = [p["name"] for p in sorted(pv["cil"], key=lambda p: (not p["id"].startswith("P-CIL"), p["id"])) if p["adopted"]]
    narrative = {
        "current": [f"{len(state['apps'])} applications across {len({a['hosting'] for a in state['apps']})} hosting models; "
                    f"{len(r['clusters'])} duplication clusters",
                    f"{r['integration']['p2p_share']}% of {r['integration']['count']} interfaces point-to-point; "
                    f"{r['integration']['manual']} manual hand-offs",
                    f"{sum(not d['owner'] for d in state['data'])} of {len(state['data'])} data domains without a named owner",
                    f"EA maturity {r['gov']['acmm_mean']} / 5 (ACMM)"],
        "target": [f"Principle: {n}" for n in adopted[:5]] + [f"Pattern: {p['name']}" for p in state["vision"].get("patterns", [])[:3]],
        "transitions": {w["id"]: [i["name"] for i in w["initiatives"]] for w in waves},
    }
    states = dict(r["states"], narrative=narrative)
    eng, health, cost = _overview_health(state, r)
    o = {
        "engagement": eng, "health": health, "cost": cost,
        "kpis": {"acmm_mean": r["gov"]["acmm_mean"],
                 "avg_cap_maturity": round(st.mean(c["maturity"] for c in r["cap_rows"]), 2),
                 "data_avg": round(st.mean(d["score"] for d in r["data_rows"])),
                 "total_cr": r["total_cr"]},
        "explain": {"acmm_mean": r["gov"]["explain"], "avg_cap_maturity": cap_avg_xp(r), "data_avg": data_avg_xp(r),
                    "total_cr": total_xp(r), "dispositions": disp_xp(r, cfg),
                    "waves": xp("Transition waves", [(f"{i['wave_id']} {i['id']}", f"{xline(i, 'Wave rule')}; dependencies: {xline(i, 'Dependencies')}")
                                                     for i in r["initiatives"]],
                                f"{len(r['initiatives'])} initiatives across {len(waves)} waves",
                                "Wave rules: size S/M with priority ≥ 16 → W0; foundation → W1 (W0 if S); priority ≥ 16 → W1; "
                                "9-15 → W2; else W3; then pushed after dependencies", "§28, §36.2.14"),
                    "adm": xp("ADM phase status", [(lbl, f"{status[p].replace('_', ' ')} · {status_why[p][0]}") for p, lbl, _ in WHEEL],
                              "Status per phase is computed from the data captured so far",
                              "Assessed / in progress / not started rules are listed per phase on hover")},
        "adm": [{"phase": p, "label": lbl, "screen": scr, "status": status[p], "explain": adm_xp[p]} for p, lbl, scr in WHEEL],
        "dispositions": [{"code": d, "name": L[d], "count": disp.get(d, 0)} for d in DISPOSITIONS if disp.get(d) or d != "Consolidate"],
        "top_gaps": top, "waves": waves, "states": states, "landscape": _landscape(state, r),
        "views": _views_index(state, r),
        "counts": {"gaps": len(r["gaps"]), "initiatives": len(r["initiatives"]), "apps": len(state["apps"]),
                   "capabilities": len(r["cap_rows"])},
    }
    o["insights"] = {"summary": overview_insights(o)}
    return o


# --------------------------------------------------------------------------- vision
PLAN_STATUSES = ("planned", "in_progress", "done", "at_risk", "milestone")


def engagement_plan(v: dict, status: dict) -> dict:
    """The KPMG engagement plan with live activity status; current week from the as-of date."""
    p = copy.deepcopy(v.get("engagement_plan") or {"phases": [], "weeks": 16, "start": None})
    if not p.get("start"):
        return p
    start = _dt.date.fromisoformat(p["start"])
    today = _dt.date.fromisoformat(p.get("as_of") or _dt.date.today().isoformat())
    p["current_week"] = max(1, min(p["weeks"], (today - start).days // 7 + 1))
    p["week_dates"] = [(start + _dt.timedelta(weeks=i)).isoformat() for i in range(p["weeks"])]
    acts = []
    for ph in p["phases"]:
        for a in ph["activities"]:
            st_, src = status.get(a["id"], (a["status"], "assumed"))
            a["status"], a["status_source"] = st_, src
            a["end_week"] = a["start_week"] + a["weeks"] - 1
            acts.append(a)
        ws = [a["start_week"] for a in ph["activities"]]
        we = [a["end_week"] for a in ph["activities"]]
        ph["start_week"], ph["end_week"] = min(ws), max(we)
        done = sum(a["status"] == "done" for a in ph["activities"])
        ph["progress"] = round(100 * done / len(ph["activities"]))
    c = collections.Counter(a["status"] for a in acts)
    p["counts"] = {k: c.get(k, 0) for k in PLAN_STATUSES} | {"total": len(acts)}
    p["progress"] = round(100 * c.get("done", 0) / max(1, len(acts) - c.get("milestone", 0)))
    n_act = len(acts) - c.get("milestone", 0)
    p["explain"] = xp("Engagement progress", [(ph["name"], f"{ph['progress']}% of {len(ph['activities'])} activities done · weeks "
                                                          f"{ph['start_week']}-{ph['end_week']}") for ph in p["phases"]],
                      f"{c.get('done', 0)} of {n_act} activities done = {p['progress']}%; week {p['current_week']} of {p['weeks']}",
                      "Milestones are excluded from the activity count; status is updated on the plan", "§6, §7")
    return p


def phase_plan(state: dict, key: str) -> dict | None:
    """The plan strip for a screen: one phase (by id) or, for a screen key, every activity tagged to that screen."""
    p = engagement_plan(state["vision"], state["plan_status"])
    if not p.get("start"):
        return None
    ph = next((x for x in p.get("phases", []) if x["id"] == key), None)
    if ph:
        acts, name = ph["activities"], ph["name"]
    else:
        acts = [a for x in p["phases"] for a in x["activities"] if key in a.get("screens", [])]
        names = [x.get("short", x["name"]) for x in p["phases"] if any(key in a.get("screens", []) for a in x["activities"])]
        name = " → ".join(names) if len(names) <= 2 else f"{names[0]} → {names[-1]}"
    if not acts:
        return None
    start = _dt.date.fromisoformat(p["start"])
    today = _dt.date.fromisoformat(p.get("as_of") or _dt.date.today().isoformat())
    w0, w1 = min(a["start_week"] for a in acts), max(a["end_week"] for a in acts)
    d0 = start + _dt.timedelta(weeks=w0 - 1)
    d1 = start + _dt.timedelta(weeks=w1 - 1, days=4)
    work = [a for a in acts if a["status"] != "milestone"]
    done = sum(a["status"] == "done" for a in work)
    prog = round(100 * done / max(1, len(work)))
    elapsed = max(0, min(100, round(100 * (today - d0).days / max(1, (d1 - d0).days + 3))))
    status = ("not_started" if today < d0 else "complete" if done == len(work)
              else "overdue" if today > d1 else "at_risk" if any(a["status"] == "at_risk" for a in work) else "in_progress")
    mss = [a for a in acts if a["status"] == "milestone"]
    ms = next((a for a in mss if a["start_week"] >= p["current_week"]), mss[-1] if mss else None)
    return {"id": key, "name": name, "start": d0.isoformat(), "end": d1.isoformat(), "as_of": today.isoformat(),
            "start_week": w0, "end_week": w1, "current_week": p["current_week"], "weeks": p["weeks"],
            "progress": prog, "elapsed": elapsed, "status": status, "source": p.get("source", "assumed"),
            "counts": {k: sum(a["status"] == k for a in acts) for k in PLAN_STATUSES},
            "milestone": {"name": ms["name"], "week": ms["start_week"],
                          "date": (start + _dt.timedelta(weeks=ms["start_week"] - 1, days=4)).isoformat()} if ms else None,
            "activities": [{k: a[k] for k in ("id", "name", "start_week", "end_week", "status", "deliverable")} for a in acts],
            "explain": xp(f"{name} progress", [(a["id"], f"{a['name'][:60]} · weeks {a['start_week']}-{a['end_week']} · {a['status'].replace('_', ' ')}")
                                               for a in acts],
                          f"{done} of {len(work)} activities done = {prog}%; {elapsed}% of the window elapsed",
                          "Activities tagged to this screen in the work plan on Approach & Plan; milestones are excluded from the count", "§6")}


def approach(s: Session) -> dict:
    """Approach & Plan: scope of work, the phase-level engagement approach and the detailed work plan."""
    state = load_state(s)
    v = state["vision"]
    plan = engagement_plan(v, state["plan_status"])
    phases = [{k: ph.get(k) for k in ("id", "name", "short", "adm", "objective", "approach", "outputs", "gate", "start_week", "end_week", "progress")}
              | {"activities": len(ph["activities"]), "phase": phase_plan(state, ph["id"])} for ph in plan.get("phases", [])]
    cur = next((p for p in phases if p["start_week"] <= plan.get("current_week", 0) <= p["end_week"] and p["progress"] < 100), None)
    return {"plan": plan, "phases": phases, "current_phase": cur["id"] if cur else None,
            "scope_of_work": v.get("scope_of_work", {}), "engagement": v["engagement"], "scope": v["scope"],
            "stakeholders": v["stakeholders"], "drivers": v["business_drivers"], "focus_areas": v["digital_focus_areas"],
            "views": state["cfg"].get("architecture_views", [])}


def vision_context(s: Session) -> dict:
    """The Architecture Vision context box: notes, uploaded documents, their themes and the generated statements."""
    from .context_docs import themes, words
    from .models import ContextDoc
    ov = s.get(SettingOverride, "vision_context")
    vc = dict(ov.value) if ov else {}
    docs = sorted(s.exec(select(ContextDoc)), key=lambda d: d.id or 0)
    corpus = "\n\n".join([vc.get("text", "")] + [d.text for d in docs])
    return {"text": vc.get("text", ""), "statements": vc.get("statements", []), "mode": vc.get("mode", ""),
            "citations": vc.get("citations", []), "updated": vc.get("updated"), "source": vc.get("source", "client"),
            "docs": [{"id": d.id, "name": d.name, "kind": d.kind, "size": d.size, "words": len(d.text.split()), "source": d.source,
                      "uploaded": d.uploaded.isoformat() if d.uploaded else None, "preview": d.text[:280]} for d in docs],
            "themes": themes(corpus) if corpus.strip() else [], "words": len(words(corpus))}


def vision(s: Session) -> dict:
    state, r = ctx(s)
    v = state["vision"]
    ai = rules.data_readiness(v["ai_initiatives"], r["data_rows"], state["cfg"])
    pv = principles_view(s, state)
    plan = engagement_plan(v, state["plan_status"])
    return {
        "plan": plan, "phase": phase_plan(state, "vision"), "scope_of_work": v.get("scope_of_work", {}),
        "context": vision_context(s),
        "engagement": v["engagement"], "drivers": v["business_drivers"], "focus_areas": v["digital_focus_areas"],
        "scope": v["scope"], "stakeholders": v["stakeholders"], "principles": pv, "ai_initiatives": ai,
        "guardrails": v.get("guardrails", []), "patterns": v.get("patterns", []), "rules": rules_config(state["cfg"]),
        "viewpoints": v.get("viewpoints", []), "tailoring": v.get("tailoring", []),
        "rfp_views": {x["n"]: {"name": x["name"], "screen": x["screen"], "view": x["view"]} for x in state["cfg"].get("architecture_views", [])},
        "vision_doc": vision_doc(s), "ai_ready_min": state["cfg"]["data_rules"].get("ai_ready_min", 60),
        "kpis": {"drivers": len(v["business_drivers"]), "principles_adopted": pv["adopted"],
                 "principles_max": pv["limit"]["max"], "ai_ready": sum(i["ready"] for i in ai), "ai_total": len(ai),
                 "scope_exclusions": len(v["scope"]["out_of_scope"]),
                 "guardrails": sum(g.get("active", True) for g in v.get("guardrails", [])),
                 "rules_on": sum(x.get("enabled", False) for x in state["cfg"]["rationalization"].get("rules", []))},
        "explain": {
            "drivers": xp("Business drivers", [(d["id"], f"{d['driver'][:70]} ({d['source']})") for d in v["business_drivers"]],
                          f"{len(v['business_drivers'])} drivers", "Captured from the engagement brief", "§7.4, §36.2.9"),
            "principles_adopted": xp("Principles adopted", [
                ("CIL & AI principles", f"{sum(p['adopted'] for p in pv['cil'])} of {len(pv['cil'])}"),
                ("TOGAF examples (§23.6)", f"{sum(p['adopted'] for p in pv['togaf'])} of {len(pv['togaf'])}: "
                 + ", ".join(p["name"] for p in pv["togaf"] if p["adopted"]))],
                f"{pv['adopted']} adopted" + (f" · {pv['warning']}" if pv["warning"] else " · inside the recommended range"),
                f"TOGAF suggests {pv['limit']['min']}-{pv['limit']['max']} principles; toggle them in the Principles tab",
                f"§{pv['limit']['ref']}"),
            "ai_ready": xp("AI initiatives data-ready", [(f"{i['id']} {i['name'][:44]}", "ready" if i["ready"] else
                                                          "blocked by " + ", ".join(f"{b['id']} ({b['score']})" for b in i["blocking"]))
                                                         for i in ai],
                           f"{sum(i['ready'] for i in ai)} of {len(ai)} ready",
                           f"Ready only if every dependent data domain scores ≥ {state['cfg']['data_rules'].get('ai_ready_min', 60)}",
                           "§23.6.2"),
            "rules_on": xp("Rationalization rules active",
                           [(x["id"], f"{'on' if x.get('enabled') else 'off'} · {x['name']}") for x in state["cfg"]["rationalization"].get("rules", [])],
                           f"{sum(x.get('enabled', False) for x in state['cfg']['rationalization'].get('rules', []))} rules on, "
                           f"threshold {fmt(state['cfg']['rationalization']['threshold'])}",
                           "Rules run in order after the fit quadrant; each is tied to a principle, guardrail or driver", "§23.6, §28.2"),
            "scope_exclusions": xp("Scope exclusions", [(f"Out {n + 1}", x) for n, x in enumerate(v["scope"]["out_of_scope"])],
                                   f"{len(v['scope']['out_of_scope'])} exclusions",
                                   "Out-of-scope applications are dispositioned 'Out of scope' and assessed for dependencies only", "§7.4"),
        },
    }


# --------------------------------------------------------------------------- business architecture
def _l3_node(x: dict, l2: dict, surveys: dict, cfg: dict) -> dict:
    sv = surveys.get(x["id"])
    sc = rules.score_l3(x, sv, cfg)
    return {"id": x["id"], "name": x["name"], "ref": x.get("ref"), "owner": x.get("owner") or l2.get("owner", ""),
            "l2_id": l2["id"], "source": x.get("source", "assumed"), "status": rules.status_of(sv), "survey": sv, "score": sc,
            "quadrant": rules.quadrant(sc["importance"], sc["alignment"], cfg) if sc else None}


def _pct(a: int, b: int) -> int:
    return round(100 * a / b) if b else 0


def _names(items: list, n: int = 3, more: bool = True) -> str:
    return ", ".join(items[:n]) + (f" and {len(items) - n} more" if more and len(items) > n else "")


def business_insights(b: dict, cfg: dict) -> dict:
    """3-4 rule-derived insights per Business Architecture tab (the AI layer rewrites them on request)."""
    l2s = [c for l1 in b["l1"] for c in l1["children"]]
    l3s = [x for c in l2s for x in c["l3"]]
    scored = [x for x in l3s if x["score"]]
    cov, roll, k = b["coverage"], b["discovery"]["rollup"], b["kpis"]
    th = b["thresholds"]
    out = {}
    # ---- 1 leading capabilities
    low = sorted(cov["by_l1"], key=lambda r: r["adopted"] / max(1, r["total"]))
    missing = [n["name"] for n in b["reference"] if n["level"] == 2 and not n["adopted_by"]]
    out["reference"] = [
        {"text": f"CIL has adopted {cov['adopted']} of {cov['total']} standard L2 capabilities ({k['coverage_pct']}%) and "
                 f"{cov['l3_adopted']} of {cov['l3_total']} standard L3 processes.", "rule": "adopted = CIL node linked to the standard entry"},
        {"text": f"Lowest coverage: {low[0]['name']} ({low[0]['adopted']}/{low[0]['total']}) and {low[1]['name']} "
                 f"({low[1]['adopted']}/{low[1]['total']}). Confirm whether these are out of scope or simply unmapped.", "rule": "coverage by L1"},
        {"text": f"Not yet in the CIL catalogue: {_names(missing, 4)}. Review them in the catalogue workshop before discovery closes.",
         "rule": "standard L2 without a CIL link"},
        {"text": (f"{len(cov['custom'])} CIL-specific capabilities have no standard reference: {', '.join(cov['custom'][:4])}."
                  if cov["custom"] else "Every CIL capability traces to a standard-practice entry, so benchmarking is like for like."),
         "rule": "CIL node without ref"}]
    # ---- 2 current state discovery
    by_l1 = sorted(b["discovery"]["by_l1"], key=lambda r: -r["pct_responded"])
    idle = [r["name"] for r in by_l1 if r["generated"] == 0]
    asks = [x for x in l3s if x["status"] in ("walkthrough", "redirected")]
    ready = [c for c in l2s if c["discovery"]["inference"]["ready"] and not c["discovery"]["analysed"]]
    out["discovery"] = [
        {"text": f"{roll['responded']} of {roll['l3']} L3 questionnaires answered ({roll['pct_responded']}%); {roll['sent']} awaiting a "
                 f"reply, {roll['draft']} drafted and {roll['not_generated']} not yet generated.", "rule": "survey status"},
        {"text": (f"{roll['walkthrough']} owner{'s' if roll['walkthrough'] != 1 else ''} asked for a walkthrough and {roll['redirected']} redirected the survey "
                  f"({_names([x['name'] for x in asks], 2)}). Resend with explanations within 48 hours to keep momentum."
                  if asks else "No owner has asked for a walkthrough or redirected a survey so far."), "rule": "response outcome"},
        {"text": f"{k['analysed_l2']} L2 capabilities are now scored from discovery evidence"
                 + (f"; {len(ready)} more have responses ready to analyse ({_names([c['name'] for c in ready], 2)})." if ready else "."),
         "rule": "L2 analysed from L3 responses"},
        {"text": f"Discovery is furthest in {by_l1[0]['name']} ({by_l1[0]['pct_responded']}% answered)"
                 + (f" and has not started in {len(idle)} L1 areas, including {_names(idle, 2)}." if idle else "."), "rule": "progress by L1"}]
    # ---- 3a process maturity
    l1m = [(l1["name"], st.mean(c["maturity"] for c in l1["children"] if c["assessed"])) for l1 in b["l1"] if any(c["assessed"] for c in l1["children"])]
    l1m.sort(key=lambda x: x[1])
    rows = [c for c in l2s if c["assessed"]]
    dim_avg = [(lbl, st.mean(c["q"][i] for c in rows)) for i, lbl in enumerate(("Process", "Technology & AI", "Data", "Integration"))]
    dim_avg.sort(key=lambda x: x[1])
    weak_l3 = sorted((x for x in scored if x["score"]["maturity"] < 2), key=lambda x: x["score"]["maturity"])
    spread = max(((c, min(x["score"]["maturity"] for x in c["l3"] if x["score"]), max(x["score"]["maturity"] for x in c["l3"] if x["score"]))
                  for c in l2s if sum(1 for x in c["l3"] if x["score"]) >= 2), key=lambda t: t[2] - t[1], default=None)
    out["process"] = [
        {"text": f"Weakest L1 areas: {l1m[0][0]} ({l1m[0][1]:.2f}) and {l1m[1][0]} ({l1m[1][1]:.2f}); strongest is {l1m[-1][0]} ({l1m[-1][1]:.2f}).",
         "rule": "L1 mean of L2 maturity"},
        {"text": f"{dim_avg[0][0]} is the weakest dimension across the estate (avg {dim_avg[0][1]:.2f}) and {dim_avg[-1][0]} the strongest "
                 f"({dim_avg[-1][1]:.2f}): hand-offs, not process discipline, hold maturity back.", "rule": "mean of each dimension over assessed L2"},
        {"text": (f"{len(weak_l3)} L3 processes score below 2.0 in discovery: {_names([x['name'] + ' ' + format(x['score']['maturity'], '.2f') for x in weak_l3], 3)}."
                  if weak_l3 else "No surveyed L3 process scores below 2.0."), "rule": "L3 maturity from responses"},
        {"text": (f"Widest spread inside an L2: {spread[0]['name']}, from {spread[1]:.2f} to {spread[2]:.2f}. The L2 average hides a weak step; "
                  "target the weakest L3, not the whole capability." if spread else "Not enough L3 evidence yet to compare steps within an L2."),
         "rule": "max - min L3 maturity per L2"}]
    # ---- 3b heat map (2x2)
    sp = th["quadrant_split"]
    drows = [c for c in rows if c["basis"] == "discovery"]
    fix = [c for c in drows if c["importance"] >= sp and c["maturity"] < sp]
    diff = [c for c in drows if c["importance"] >= sp and c["maturity"] >= sp]
    over = [c for c in drows if c["importance"] < sp and c["maturity"] >= sp]
    worst = sorted(fix, key=lambda c: (-c["importance"], c["maturity"]))
    out["matrix"] = [
        {"text": f"{len(drows)} of {len(l2s)} L2 capabilities are fully discovered and plotted; the rest appear as their L3 questionnaires are analysed.",
         "rule": "only L2 scored from discovery"},
        {"text": (f"{len(fix)} sit in 'Fix now' (business criticality ≥ {fmt(sp)}, maturity < {fmt(sp)}): "
                  f"{_names([c['name'] + ' (' + format(c['maturity'], '.2f') + ')' for c in worst], 3)}." if fix
                  else f"No discovered capability is both business-critical and below {fmt(sp)} maturity."), "rule": "equal quadrants at 2.5"},
        {"text": f"{len(diff)} business-critical capabilities are at or above {fmt(sp)}: protect and build them out rather than re-platform.",
         "rule": f"criticality ≥ {fmt(sp)} and maturity ≥ {fmt(sp)}"},
        {"text": (f"{len(over)} capabilities are mature but less critical ({_names([c['name'] for c in over], 3)}): hold investment, run for cost."
                  if over else "No discovered capability is over-invested relative to its business criticality."),
         "rule": f"criticality < {fmt(sp)} and maturity ≥ {fmt(sp)}"}]
    # ---- 3c business-IT alignment
    pts = [x for x in scored if x["score"]["alignment"] is not None]
    if pts:
        qc = collections.Counter(x["quadrant"]["key"] for x in pts)
        under = sorted((x for x in pts if x["quadrant"]["key"] == "underserved"), key=lambda x: (x["score"]["alignment"], -x["score"]["importance"]))
        part_avg = collections.defaultdict(list)
        for x in pts:
            for p in x["score"]["alignment_parts"]:
                part_avg[p["label"]].append(p["value"])
        part_avg = sorted(((k, st.mean(v)) for k, v in part_avg.items()), key=lambda t: t[1])
        l2a = sorted((c for c in l2s if c["discovery"]["inference"]["alignment"] is not None), key=lambda c: c["discovery"]["inference"]["alignment"])
        out["alignment"] = [
            {"text": f"{len(pts)} surveyed L3 processes: {qc.get('aligned', 0)} aligned, {qc.get('underserved', 0)} under-served, "
                     f"{qc.get('overserved', 0)} over-served, {qc.get('low', 0)} low priority. Average alignment {st.mean(x['score']['alignment'] for x in pts):.2f} / 5.",
             "rule": "alignment = mean of the five alignment answers"},
            {"text": f"Most under-served: {_names([x['name'] + ' (' + format(x['score']['alignment'], '.1f') + ')' for x in under], 3, False)}. "
                     "Business need is high and systems do not keep up." if under else "No business-critical process is under-served by IT.",
             "rule": f"criticality ≥ {fmt(sp)} and alignment < {fmt(sp)}"},
            {"text": f"Weakest alignment factor across the estate is {part_avg[0][0].lower()} ({part_avg[0][1]:.2f}); strongest is "
                     f"{part_avg[-1][0].lower()} ({part_avg[-1][1]:.2f}). "
                     + ("Fix the systems themselves in the roadmap." if part_avg[0][0] in ("System fit", "Information & reporting", "User adoption")
                        else "Ways of working are the bigger gap: a named IT counterpart and a joint, funded backlog would lift alignment fastest."),
             "rule": "mean of each alignment question"},
            {"text": f"Lowest-aligned L2: {l2a[0]['name']} ({l2a[0]['discovery']['inference']['alignment']:.2f}). "
                     f"{len(l2s) - len(l2a)} L2s have no alignment evidence yet." if l2a else "No L2 has alignment evidence yet.",
             "rule": "L2 alignment = mean of its L3"}]
    else:
        out["alignment"] = [{"text": "No discovery responses yet: alignment appears once owners answer the fit and partnering questions.", "rule": "discovery"}]
    # ---- 3d entanglement
    ent = b["entanglement"]
    top = sorted(ent["nodes"], key=lambda n: -n["score"])
    gap_ids = {g["ref"] for g in b["gaps"]}
    hot = [n for n in ent["nodes"] if n["high"] and n["id"] in gap_ids]
    l1n = {l1["id"]: l1["name"] for l1 in b["l1"]}
    link = max(ent["l1_links"], key=lambda x: x["count"], default=None)
    app_cnt = collections.Counter(a["name"] for c in l2s for a in c["apps"])
    hub = app_cnt.most_common(1)[0] if app_cnt else None
    out["entanglement"] = [
        {"text": f"Most entangled: {_names([n['name'] for n in top], 3, False)}. Changes here ripple across value chains.",
         "rule": "upstream + downstream + shared-app coupling"},
        {"text": f"{len(hot)} capability gaps are also highly entangled ({_names([n['name'] for n in hot], 3)}): sequence them with their upstream dependencies."
                 if hot else "No capability gap is highly entangled, so gaps can be closed independently.", "rule": "gap with high coupling"},
        {"text": f"Strongest cross-area dependency: {l1n.get(link['from'], link['from'])} → {l1n.get(link['to'], link['to'])} ({link['count']} L2 links)."
                 if link else "No cross-L1 dependencies recorded.", "rule": "L2 dependencies between L1 areas"},
        {"text": f"{hub[0]} supports {hub[1]} capabilities, the main coupling point; its roadmap decisions affect every one of them." if hub else "",
         "rule": "capabilities per application"}]
    # ---- 4 gap register
    reg = b["gap_register"]
    tx, thm = reg["transactional"], reg["thematic"]
    dim_name = {k: lbl for k, _, lbl in rules.discovery.DIM_Q}
    dims = collections.Counter(d for g in tx for d in g["dims"]).most_common(1)
    conc = collections.Counter(g["l1"]["name"] for g in tx).most_common(1)
    out["gaps"] = [
        {"text": f"Discovery surfaces {len(tx)} transactional gaps at L3 and {len(thm)} thematic gaps across L1 and L0; "
                 f"{reg['counts']['High']} are high severity.", "rule": "from answered L3 questionnaires only"},
        {"text": (f"{dim_name[dims[0][0]]} is the most common weakness, in {dims[0][1]} of {len(tx)} transactional gaps." if dims
                  else "No transactional gap yet: gaps appear as L3 questionnaires come back."), "rule": "weak dimension = answer ≤ 2"},
        {"text": (f"{conc[0][0]} holds {conc[0][1]} of the transactional gaps, the largest concentration." if conc else ""), "rule": "gaps by L1"},
        {"text": (f"Highest-severity themes: {_names([g['title'] for g in thm if g['severity'] == 'High'], 2)}. Treat these as foundation "
                  "initiatives on the roadmap rather than process fixes." if any(g["severity"] == "High" for g in thm)
                  else "No high-severity theme yet; thematic gaps strengthen as more L1 areas are surveyed."), "rule": "thematic severity"}]
    # ---- 5 architecture views
    l3_by = {x["id"]: x for x in l3s}
    l2_by = {c["id"]: c for c in l2s}
    fn = [(m, n) for m in b["models"] for n in m["nodes"] if n["type"] == "function"]
    linked = [(m, n) for m, n in fn if n.get("cap") in l3_by]
    assoc = {(m["id"], e["from"]) for m in b["models"] for e in m["edges"] if e.get("kind") == "assoc"}
    manual = [n["label"] for m, n in fn if (m["id"], n["id"]) not in assoc]

    def mat(n):
        x = l3_by[n["cap"]]
        return x["score"]["maturity"] if x["score"] else l2_by[x["l2_id"]]["maturity"] or 9
    weakest = sorted(linked, key=lambda t: mat(t[1]))
    gap_steps = [n["label"] for _, n in linked if l2_by[l3_by[n["cap"]]["l2_id"]]["is_gap"]]
    out["models"] = [
        {"text": f"{len(b['models'])} process models with {len(fn)} functions; {len(linked)} are linked to L3 capabilities, so every step carries its maturity.",
         "rule": "function → L3 link"},
        {"text": f"Weakest steps: {_names([n['label'] + ' (' + format(mat(n), '.2f') + ')' for _, n in weakest], 3, False)}.", "rule": "L3 maturity, else L2"},
        {"text": f"{len(manual)} functions have no supporting system in the model: {_names(manual, 3)}. Confirm whether they are manual." if manual
                 else "Every function has a supporting system.", "rule": "function without a system association"},
        {"text": f"{len(gap_steps)} steps sit on capability gaps ({_names(gap_steps, 2)}): the process breaks where the gaps are.",
         "rule": "step's L2 is a gap"}]
    return {k2: [i for i in v if i["text"]] for k2, v in out.items()}


def business(s: Session) -> dict:
    state, r = ctx(s)
    cfg = state["cfg"]
    L = labels(cfg)
    rows = {c["id"]: c for c in r["cap_rows"]}
    rowa = {a["id"]: a for a in r["app_rows"]}
    gap_ids = {g["ref"]: g for g in r["parity"]["gaps"] if g["kind"] == "capability"}
    serving = collections.defaultdict(list)
    for a in state["apps"]:
        for c in a["caps"]:
            serving[c].append({"id": a["id"], "name": a["name"], "disposition": rowa[a["id"]]["disposition"],
                               "label": L.get(rowa[a["id"]]["disposition"], rowa[a["id"]]["disposition"])})
    ent = {n["id"]: n for n in r["entanglement"]["nodes"]}
    surveys = state["surveys"]

    def node(c: dict, l1: dict) -> dict:
        l3 = [_l3_node(x, c, surveys, cfg) for x in c.get("l3", [])]
        inf = rules.infer_l2(c, c.get("l3", []), surveys, cfg)
        disc = c.get("discovery") or {}
        analysed = bool(disc.get("analysed_at"))
        base = {"description": c.get("description", ""), "owner": c.get("owner", ""), "ref": c.get("ref"),
                "depends_on": c.get("depends_on", []), "automation": c.get("automation", ""),
                "apps": serving.get(c["id"], []), "catalog_source": c.get("catalog_source", "assumed"),
                "entanglement": ent.get(c["id"]), "l3": l3,
                "discovery": {"analysed": analysed, "analysed_at": disc.get("analysed_at"), "by": disc.get("by"),
                              "comments": disc.get("comments", {}), "inference": inf, "rollup": rules.rollup(l3),
                              "stale": analysed and inf["q"] is not None and (inf["q"] != c.get("q") or inf["importance"] != c.get("importance"))},
                "basis": "discovery" if analysed else ("baseline" if c.get("q") else None)}
        if c["id"] in rows:
            return dict(rows[c["id"]], **base, assessed=True, gap=gap_ids.get(c["id"]))
        return dict(base, id=c["id"], l1_id=l1["id"], l1=l1["name"], name=c["name"], q=None, maturity=None,
                    importance=c.get("importance"), band=None, focus=c.get("focus"), is_gap=False, assessed=False,
                    source=c.get("source", "assumed"), gap=None, target=None, ai_level=None, explain=None)
    l1s = [{"id": l1["id"], "name": l1["name"], "owner": l1.get("owner", ""), "ref": l1.get("ref"), "l0": l1.get("l0"),
            "description": l1.get("description", ""), "source": l1.get("source", "assumed"),
            "children": [node(c, l1) for c in l1["children"]]} for l1 in state["caps"]["capabilities"]]
    for l1 in l1s:
        l3 = [x for c in l1["children"] for x in c["l3"]]
        ms = [c["maturity"] for c in l1["children"] if c["assessed"]]
        l1["rollup"] = dict(rules.rollup(l3), l2=len(l1["children"]), analysed=sum(c["discovery"]["analysed"] for c in l1["children"]),
                            maturity=round(st.mean(ms), 2) if ms else None, gaps=sum(c["is_gap"] for c in l1["children"]))
    l0s = []
    for l0 in state["caps"].get("l0", []):
        mine = [l1 for l1 in l1s if l1["l0"] == l0["id"]]
        l3 = [x for l1 in mine for c in l1["children"] for x in c["l3"]]
        ms = [c["maturity"] for l1 in mine for c in l1["children"] if c["assessed"]]
        l0s.append(dict(l0, rollup=dict(rules.rollup(l3), l1=len(mine), l2=sum(len(l1["children"]) for l1 in mine),
                                         analysed=sum(l1["rollup"]["analysed"] for l1 in mine),
                                         maturity=round(st.mean(ms), 2) if ms else None,
                                         gaps=sum(l1["rollup"]["gaps"] for l1 in mine))))
    cap_gaps = sorted(gap_ids.values(), key=lambda g: -g["priority"])
    focus_ids = {f["id"] for f in state["vision"]["digital_focus_areas"]}
    covered = {c["focus"] for c in r["cap_rows"] if c["focus"]} & focus_ids
    q_digital = next(q for q in state["caps"]["questionnaire"]["questions"] if q["key"] == "digital")
    ladder = [{"n": o["n"], "label": o["label"], "hint": o["hint"],
               "caps": [c["id"] for c in r["cap_rows"] if c["q"][1] == o["n"]]} for o in q_digital["options"]]
    ai_on = sum(c["q"][1] >= 4 for c in r["cap_rows"])
    cat = [x for l1 in state["caps"]["capabilities"] for x in [l1] + l1["children"] + [y for c in l1["children"] for y in c.get("l3", [])]]
    adopted_by = {x.get("ref"): x["id"] for x in cat if x.get("ref")}
    reference = [dict(n, adopted_by=adopted_by.get(n["id"])) for n in state["reference"]]
    cov = dict(r["coverage"], l3_total=sum(n["level"] == 3 for n in state["reference"]),
               l3_adopted=sum(1 for n in state["reference"] if n["level"] == 3 and n["id"] in adopted_by))
    all_l3 = [x for l1 in l1s for c in l1["children"] for x in c["l3"]]
    roll = rules.rollup(all_l3)
    scored = [x for x in all_l3 if x["score"] and x["score"]["alignment"] is not None]
    analysed = [c for l1 in l1s for c in l1["children"] if c["discovery"]["analysed"]]
    al_avg = round(st.mean(x["score"]["alignment"] for x in scored), 2) if scored else None
    under = [x for x in scored if x["quadrant"]["key"] == "underserved"]
    n_l2 = sum(len(l1["children"]) for l1 in state["caps"]["capabilities"])
    d_seed = read_seed()["discovery"]
    app_names = {a["id"]: short(a["name"]) for a in state["apps"]}
    register = r["registers"]["business"]
    ent_l3 = rules.l3_entanglement(state["caps"], surveys, r["entanglement"]["nodes"], app_names)
    b = {
        "l0": l0s, "l1": l1s, "questionnaire": state["caps"]["questionnaire"], "gaps": cap_gaps,
        "gap_register": register, "entanglement_l3": ent_l3,
        "reference": reference, "coverage": cov, "entanglement": r["entanglement"],
        "ladder": ladder, "apps": [{"id": a["id"], "name": a["name"]} for a in state["apps"]],
        "focus_areas": state["vision"]["digital_focus_areas"], "bands": cfg["capability_rules"]["heat_bands"],
        "thresholds": {k: cfg["capability_rules"].get(k, d) for k, d in (("gap_importance_min", 4), ("gap_maturity_max", 2.5), ("alignment_min", 3),
                                                                         ("quadrant_split", 2.5))},
        "target_maturity": cfg["capability_rules"].get("target_maturity", {}),
        "discovery": {"rollup": roll, "by_l1": [dict(l1["rollup"], id=l1["id"], name=l1["name"]) for l1 in l1s],
                      "response_options": d_seed["response_options"], "inference": d_seed["_meta"]["inference"],
                      "template": [{k: q.get(k) for k in ("id", "label", "dim", "type")} for q in d_seed["template"]]},
        "models": state["process_models"], "plan": phase_plan(state, "business"),
        "kpis": {"avg_maturity": round(st.mean(c["maturity"] for c in r["cap_rows"]), 2),
                 "weak_critical": sum(c["band"] in ("weak", "critical") for c in r["cap_rows"]),
                 "n_caps": len(r["cap_rows"]), "n_catalog": n_l2, "n_l1": len(l1s), "n_l0": len(l0s), "n_l3": len(all_l3),
                 "gaps": len(cap_gaps), "high_priority_gaps": sum(g["priority"] >= 20 for g in cap_gaps),
                 "focus_covered": len(covered), "focus_total": len(focus_ids),
                 "coverage_pct": round(100 * cov["adopted"] / max(1, cov["total"])), "ai_enabled": ai_on,
                 "entangled": r["entanglement"]["high"], "responded": roll["responded"], "generated": roll["generated"],
                 "analysed_l2": len(analysed), "alignment_avg": al_avg, "underserved": len(under)},
        "explain": {
            "avg_maturity": xp("Average capability maturity", cap_avg_xp(r)["lines"]
                               + [("Basis", f"{len(analysed)} L2 scored from L3 discovery; {len(r['cap_rows']) - len(analysed)} on the baseline")],
                               cap_avg_xp(r)["result"], cap_avg_xp(r)["rule"], "§8.4, §32"),
            "weak_critical": xp("Weak or critical capabilities", [(bd, ", ".join(c["id"] for c in r["cap_rows"] if c["band"] == bd) or "none")
                                                                  for bd in ("critical", "weak")],
                                f"{sum(c['band'] in ('weak', 'critical') for c in r['cap_rows'])} of {len(r['cap_rows'])} L2",
                                "Bands: critical < 1.5, weak 1.5-2.5, developing 2.5-3.5, strong ≥ 3.5", "§8.4"),
            "gaps": xp("Capability gaps", [(g["ref"], f"{g['title'][13:]} · {g['impact']} × {g['urgency']} = {g['priority']}") for g in cap_gaps],
                       f"{len(cap_gaps)} gaps; {sum(g['priority'] >= 20 for g in cap_gaps)} at priority ≥ 20",
                       f"Gap if importance ≥ {cfg['capability_rules'].get('gap_importance_min', 4)} and maturity ≤ "
                       f"{cfg['capability_rules'].get('gap_maturity_max', 2.5)}; priority = importance × urgency", "§27"),
            "focus_covered": xp("Focus areas covered", [(f"{f['id']} {f['name']}", ", ".join(c["id"] for c in r["cap_rows"] if c["focus"] == f["id"]) or "none")
                                                        for f in state["vision"]["digital_focus_areas"]],
                                f"{len(covered)} of {len(focus_ids)} focus areas mapped to at least one L2",
                                "Focus-area capabilities get urgency 5 when they are gaps", "§32"),
            "coverage_pct": cov["explain"],
            "ai_enabled": xp("Technology & AI enablement", [(f"{o['n']} {o['label']}", f"{len(o['caps'])}: {', '.join(o['caps']) or '–'}") for o in ladder],
                             f"{ai_on} of {len(r['cap_rows'])} assessed L2 at AI-enabled (4) or Agentic AI (5)",
                             "Technology & AI dimension: Manual / siloed → Digitised → Integrated automation → AI-enabled → Agentic AI",
                             "§8.4, §32"),
            "entangled": xp("Highly entangled capabilities", [(n["id"], n['name']) for n in r["entanglement"]["nodes"] if n["high"]] or [("None", "–")],
                            f"{r['entanglement']['high']} L2 with high coupling",
                            "Score = upstream + downstream dependencies + capabilities sharing an application", "§27"),
            "responded": xp("Current-state discovery", [(st_.replace("_", " ").capitalize(), str(roll[st_])) for st_ in rules.STATUSES]
                            + [("L2 analysed", f"{len(analysed)}: {', '.join(c['id'] for c in analysed) or 'none'}")],
                            f"{roll['responded']} of {roll['l3']} L3 answered = {roll['pct_responded']}%",
                            "One questionnaire per L3; L2 scores are inferred once its responses are analysed", "§8.4"),
            "alignment_avg": xp("Business-IT alignment", [(f"{x['id']} {x['name'][:38]}", " + ".join(str(p["value"]) for p in x["score"]["alignment_parts"])
                                                          + f" → {fmt(x['score']['alignment'])}") for x in scored] or [("No responses", "–")],
                                f"Mean of {len(scored)} L3 = {fmt(al_avg) if al_avg is not None else '–'}; {len(under)} under-served",
                                "Alignment = mean of the five alignment answers (system fit, partnering, information & reporting, "
                                f"responsiveness to change, user adoption); under-served if business criticality ≥ {fmt(cfg['capability_rules'].get('quadrant_split', 2.5))} "
                                f"and alignment < {fmt(cfg['capability_rules'].get('quadrant_split', 2.5))}", "§35.6.3"),
        },
    }
    b["insights"] = business_insights(b, cfg)
    return b


# --------------------------------------------------------------------------- applications
def form_options(cfg: dict) -> dict:
    return {c["key"]: c["enum"] for c in cfg["templates"]["applications"]["columns"] if "enum" in c}


def _app_cap_tree(state: dict, r: dict) -> dict:
    """L0 > L1 > L2 > L3 with the applications serving each level: L2 from the app's capability mapping, L3 from the
    systems named in the L3 discovery answers."""
    cfg = state["cfg"]
    cr = {c["id"]: c for c in r["cap_rows"]}
    app_ids = {a["id"] for a in state["apps"]}
    serving = collections.defaultdict(list)
    for a in state["apps"]:
        for c in a["caps"]:
            serving[c].append(a["id"])
    surveys = state["surveys"]

    def l3n(x: dict) -> dict:
        sv = surveys.get(x["id"])
        ans = ((sv or {}).get("answers") or {}).get("systems") or {}
        sc = rules.score_l3(x, sv, cfg)
        return {"id": x["id"], "name": x["name"], "status": rules.status_of(sv),
                "apps": [a for a in ans.get("apps", []) if a in app_ids], "other": ans.get("other", ""),
                "fit": sc["fit"] if sc else None, "alignment": sc["alignment"] if sc else None}

    def l2n(c: dict) -> dict:
        row = cr.get(c["id"])
        analysed = bool((c.get("discovery") or {}).get("analysed_at"))
        return {"id": c["id"], "name": c["name"], "owner": c.get("owner", ""), "apps": serving.get(c["id"], []),
                "maturity": row["maturity"] if row else None, "band": row["band"] if row else None,
                "is_gap": bool(row and row["is_gap"]), "importance": c.get("importance"),
                "basis": "discovery" if analysed else ("baseline" if row else None), "l3": [l3n(x) for x in c.get("l3", [])]}
    l1s = [{"id": l1["id"], "name": l1["name"], "l0": l1.get("l0"), "children": [l2n(c) for c in l1["children"]]}
           for l1 in state["caps"]["capabilities"]]
    return {"l0": [{"id": x["id"], "name": x["name"]} for x in state["caps"].get("l0", [])], "l1": l1s}


def application_insights(a: dict, state: dict) -> dict:
    """3-4 rule-derived insights per Application Architecture tab (the AI layer rewrites them on request)."""
    apps, k, L = a["apps"], a["kpis"], a["labels"]
    inscope = [x for x in apps if x["in_scope"]]
    out = {}
    no_owner = [x for x in apps if not x.get("business_owner")]
    unknown = [x["name"] for x in apps if x["lifecycle"] == "Unknown"]
    tbd = [x["name"] for x in apps if x["vendor"] == "TBD"]
    host = collections.Counter(x["hosting"] for x in apps)
    out["intake"] = [
        {"text": f"{len(apps)} applications inventoried against a target of {k['target']} external; {len(no_owner)} have no named "
                 f"business owner yet.", "rule": "business owner missing"},
        {"text": (f"{len(unknown)} lifecycles to validate: {_names(unknown, 4)}." if unknown else "Every lifecycle status is recorded."),
         "rule": "lifecycle = Unknown"},
        {"text": (f"Vendor is TBD for {len(tbd)} applications ({_names(tbd, 3)}); confirm with the IT owners before fit scoring."
                  if tbd else "Every application has a named vendor or product."), "rule": "vendor = TBD"},
        {"text": "Hosting mix: " + ", ".join(f"{n} {h}" for h, n in host.most_common())
                 + (f". Hosting is unknown for {host['Unknown']}; collect it in the intake." if host.get("Unknown") else "."), "rule": "count by hosting"}]
    disp = k["dispositions"]
    cl = sorted(a["clusters"], key=lambda c: -len(c["apps"]))
    weak_tf = sorted(inscope, key=lambda x: x["computed"]["technical_fit"])[:3]
    rules_on = [x for x in state["cfg"]["rationalization"].get("rules", []) if x.get("enabled")]
    out["rationalization"] = [
        {"text": "Dispositions: " + ", ".join(f"{disp[d]} {L[d].lower()}" for d in DISPOSITIONS if disp.get(d)) + ".",
         "rule": "fit quadrant, then rules in order"},
        {"text": (f"{len(cl)} duplication clusters; the largest is {cl[0]['cap_name']} with {len(cl[0]['apps'])} applications, "
                  f"proposed survivor {short(cl[0]['survivor_name'])}." if cl else "No L2 capability is served by two or more in-scope applications."),
         "rule": "L2 served by ≥ 2 in-scope apps"},
        {"text": "Weakest technical fit: " + ", ".join(f"{short(x['name'])} ({x['computed']['technical_fit']:.2f})" for x in weak_tf) + ".",
         "rule": "in-scope apps by technical fit"},
        {"text": f"{len(rules_on)} rationalization rules active and {k['overridden']} architect override{'s' if k['overridden'] != 1 else ''} "
                 "recorded; every disposition keeps its rule trace.", "rule": "rules configured on Vision & Guardrails"}]
    l2s = [c for l1 in a["cap_tree"]["l1"] for c in l1["children"]]
    bare = [c["name"] for c in l2s if not c["apps"] and not any(x["apps"] for x in c["l3"])]
    gaps = [c for c in l2s if c["is_gap"]]
    weak_apps = {x["id"] for x in apps if x["computed"]["disposition"] in ("Migrate", "Eliminate")}
    gap_weak = [c["name"] for c in gaps if not c["apps"] or all(i in weak_apps for i in c["apps"])]
    l3s = [x for c in l2s for x in c["l3"] if x["status"] == "responded"]
    manual = [x for x in l3s if not x["apps"] or any(w in x["other"].lower() for w in ("excel", "email", "paper", "whatsapp"))]
    top = collections.Counter(i for c in l2s for i in c["apps"]).most_common(1)
    name = {x["id"]: short(x["name"]) for x in apps}
    out["capability"] = [
        {"text": f"{len(l2s) - len(bare)} of {len(l2s)} L2 capabilities have at least one supporting application; {len(bare)} have none at L2 or L3"
                 + (f" ({_names(bare, 3)})." if bare else "."), "rule": "app capability mapping"},
        {"text": (f"{len(gap_weak)} of {len(gaps)} capability gaps have no application or only apps proposed for "
                  f"{L['Migrate'].lower()} / {L['Eliminate'].lower()}: {_names(gap_weak, 3)}." if gaps else "No capability gaps recorded."),
         "rule": "gap L2 × disposition of serving apps"},
        {"text": (f"Discovery names the systems for {len(l3s)} L3 processes; {len(manual)} still run partly on Excel, email, WhatsApp or paper."
                  if l3s else "No L3 discovery answers yet; L3 system usage appears as questionnaires come back."),
         "rule": "L3 'systems' answer"},
        {"text": (f"{name.get(top[0][0], top[0][0])} supports {top[0][1]} L2 capabilities, the platform most of the business depends on."
                  if top else "No capability mappings yet."), "rule": "most-mapped application"}]
    by_layer = collections.Counter(x.get("layer") or "Enterprise Apps" for x in apps)
    out_scope = [short(x["name"]) for x in apps if not x["in_scope"]]
    rv = a.get("ref_view")
    out["architecture"] = [
        {"text": "By layer: " + ", ".join(f"{by_layer.get(ly, 0)} {ly}" for ly in LAYERS) + ".", "rule": "count by layer"},
        *([{"text": f"Application architecture: {rv['counts']['total']} building blocks, {rv['counts']['missing']} do not exist at CIL "
                    f"and {rv['counts']['partial']} have some gaps.", "rule": "count by block status"}] if rv else []),
        {"text": f"{len(out_scope)} applications are out of scope and assessed for dependencies only: {_names(out_scope, 3)}.",
         "rule": "in_scope = false"},
        {"text": (f"{n_pii} applications are flagged as holding personal data and fall under DPDP Act 2023 controls."
                  if (n_pii := sum(bool(x.get("pii")) for x in apps)) else
                  "No application is flagged as holding personal data yet; confirm the PII flag for the farmer, dealer and HR systems in the intake."),
         "rule": "pii flag"}]
    ig = a["integration"]
    hs = ig["hotspots"][:3]
    out["interaction"] = [
        {"text": "Integration hotspots: " + ", ".join(f"{short(h['name'])} ({h['degree']})" for h in hs) + ".",
         "rule": f"≥ {ig['hotspot_min']} interfaces"},
        {"text": f"{len(a['external'])} external parties exchange data with CIL systems: {_names([x['name'] for x in a['external']], 3)}.",
         "rule": "external endpoints"},
        {"text": f"{len(a['interfaces'])} interfaces recorded across {len({x for i in a['interfaces'] for x in (i['from'], i['to'])})} applications and partners.",
         "rule": "Interface Catalog"}]
    out["integration"] = [
        {"text": f"{ig['p2p_share']}% of {ig['count']} interfaces are point-to-point; route the hotspots through the governed API layer first.",
         "rule": "via = Point-to-point"},
        {"text": f"{ig['legacy_share']}% move data by file, database link or manual re-key; {ig['manual']} are manual hand-offs.",
         "rule": "pattern in file / DB / manual"},
        {"text": "Patterns: " + ", ".join(f"{n} {p.lower()}" for p, n in sorted(ig["by_pattern"].items(), key=lambda t: -t[1])) + ".",
         "rule": "count by pattern"}]
    return out


def applications(s: Session) -> dict:
    state, r = ctx(s)
    cfg = state["cfg"]
    L = labels(cfg)
    l2 = l2_index(state)
    rows = {a["id"]: a for a in r["app_rows"]}
    apps = [dict(a, computed=rows[a["id"]], cap_names=[l2[c]["name"] for c in a["caps"] if c in l2],
                 interfaces=sum(i["from"] == a["id"] or i["to"] == a["id"] for i in state["integrations"]))
            for a in state["apps"]]
    name = {a["id"]: a["name"] for a in state["apps"]} | {x["id"]: x["name"] for x in state["external"]}
    clusters = _clusters(state, r)
    disp = collections.Counter(a["disposition"] for a in r["app_rows"])
    integ = r["integration"]
    rule_off = [x for x in cfg["rationalization"].get("rules", []) if not x.get("enabled")]
    a = {
        "plan": phase_plan(state, "applications"), "cap_tree": r["registers"]["cap_tree"],
        "ref_view": r["registers"]["app_ref"],
        "apps": apps, "clusters": clusters, "l2": list(l2.values()), "labels": L,
        "label_desc": {d: cfg["rationalization"].get("labels", {}).get(d, {}).get("desc", "") for d in DISPOSITIONS},
        "threshold": cfg["rationalization"]["threshold"], "layers": LAYERS,
        "interfaces": [dict(i, from_name=name.get(i["from"], i["from"]), to_name=name.get(i["to"], i["to"])) for i in state["integrations"]],
        "external": state["external"], "integration": integ,
        "patterns": read_seed()["integration_meta"]["patterns"],
        "domains": [{"id": d["id"], "name": d["name"]} for d in state["data"]],
        "options": form_options(cfg), "template_columns": cfg["templates"]["applications"]["columns"],
        "kpis": {"inventoried": len(apps), "target": "core + 50-60", "dispositions": {d: disp.get(d, 0) for d in DISPOSITIONS},
                 "clusters": len(clusters), "lifecycle_unknown": sum(a["validate_lifecycle"] for a in r["app_rows"]),
                 "interfaces": integ["count"], "p2p_share": integ["p2p_share"],
                 "overridden": sum(a["overridden"] for a in r["app_rows"])},
        "explain": {
            "inventoried": xp("Applications inventoried", [(k, str(v)) for k, v in collections.Counter(a.get("layer") or "Enterprise Apps" for a in apps).items()],
                              f"{len(apps)} applications in the catalog",
                              "Representative subset; the estate has core apps plus 50-60 external apps", "§35.6.5"),
            "dispositions": disp_xp(r, cfg),
            "clusters": xp("Duplication clusters", [(c["cap"], f"{', '.join(c['apps'])} → {c['survivor']}") for c in clusters],
                           f"{len(clusters)} clusters", "An L2 capability served by ≥ 2 in-scope apps forms a cluster"
                           + ("" if not rule_off else "; enable RR-04 on Vision & Guardrails to consolidate non-survivors"), "§27"),
            "lifecycle_unknown": xp("Lifecycle unknown", [(a["id"], a["name"]) for a in r["app_rows"] if a["validate_lifecycle"]],
                                    f"{sum(a['validate_lifecycle'] for a in r['app_rows'])} applications",
                                    "Lifecycle 'Unknown' is a discovery flag, not a disposition", "§34.6"),
            "p2p_share": integ["explain"]["p2p_share"], "manual": integ["explain"]["manual"], "hotspots": integ["explain"]["hotspots"],
        },
    }
    a["tech_health"] = r["registers"]["health"]
    a["gap_register"] = r["registers"]["application"]
    a["insights"] = application_insights(a, state)
    a["insights"]["health"] = health_insights(a, budget_view(state, r))
    a["insights"]["gaps"] = gap_insights(a["gap_register"], "application")
    return a


def gap_insights(reg: dict, what: str) -> list[dict]:
    """3-4 insights for a domain gap register (applications or data & technology)."""
    g, c = reg["gaps"], reg["counts"]
    high = [x for x in g if x["severity"] == "High"]
    by_init = collections.Counter(x["initiative_name"] for x in g if x["initiative_name"])
    cats = sorted(c["by_category"].items(), key=lambda t: -t[1])
    return [
        {"text": f"{len(g)} {what} gaps: {c['item']} on individual items and {c['portfolio']} across the portfolio; "
                 f"{c['High']} high, {c['Medium']} medium, {c['Low']} low severity.", "rule": "one gap per item, highest severity wins"},
        {"text": "By category: " + ", ".join(f"{k} {v}" for k, v in cats) + ".", "rule": "gap category"},
        {"text": ("High severity: " + _names([x["title"].split(" (")[0] for x in high], 4) + ".") if high else "No high-severity gaps.", "rule": "severity = High"},
        {"text": "Closed mainly by: " + ", ".join(f"{k} ({v})" for k, v in by_init.most_common(3)) + ".", "rule": "gap → roadmap initiative"},
    ]


def health_insights(a: dict, bv: dict) -> list[dict]:
    th = a["tech_health"]
    rows = {x["id"]: x for x in th["rows"]}
    k = th["counts"]
    high = sorted((x for x in th["rows"] if x["debt_band"] == "High" and x["in_scope"]), key=lambda x: -(x["debt"] or 0))
    spof = [x for x in th["rows"] if x["spof_status"] == "SPOF" and x["in_scope"]]
    scal = [x for x in th["rows"] if x["scal_status"] == "At risk" and x["in_scope"]]
    sup = next((h for h in bv["heads"] if h["kind"] == "applications"), None)
    out = [
        {"text": f"{k['high_debt']} of {k['in_scope']} in-scope applications carry high technical debt (average {k['avg_debt']}/100); highest: "
                 + ", ".join(f"{short(x['name'])} ({x['debt']})" for x in high[:3]) + ".", "rule": "weighted debt score ≥ 60"},
        {"text": (f"{len(spof)} single points of failure: " + "; ".join(f"{short(x['name'])} ({x['spof'][0]})" for x in spof[:3]) + "."
                  if spof else "No single point of failure found in the intake; confirm DR for applications marked Check."), "rule": "criticality ≥ 4 with weak DR, key person, hub or no fallback"},
        {"text": (f"{len(scal)} applications are at scalability risk at peak season: {_names([short(x['name']) for x in scal], 3)}."
                  if scal else "No application is flagged at scalability risk."), "rule": "peak load, scaling model, L3 answers"},
    ]
    if sup:
        out.append({"text": f"Application support & AMC is ₹{sup['latest']} Cr a year ({sup['growth']}% over the period); "
                            f"retiring high-debt applications is the main lever to bend it.", "rule": "IT Budget opex head"})
    return out


# --------------------------------------------------------------------------- IT budget
def budget_view(state: dict, r: dict) -> dict:
    return rules.assess_budget(state["budget"], state["cfg"], r.get("fy_budget"))


def budget_facts(state: dict, r: dict) -> dict:
    """Compact cost facts shared with every screen's AI prompts and insights."""
    bv = budget_view(state, r)
    lt = bv["latest"]
    nxt = next((x for x in bv["per_fy"] if not x["actual"]), None)
    return {"unit": "INR Cr", "provenance": state["budget"].get("source", "assumed"),
            "latest_actual": {k: lt[k] for k in ("fy", "total", "opex", "salaries", "capex", "pct_revenue", "change_share")},
            "next_plan": {k: nxt[k] for k in ("fy", "total", "capex", "pct_revenue")} if nxt else None,
            "cagr_pct": bv["cagr"], "benchmark_pct_revenue": bv["benchmark"],
            "largest_opex_heads": [f"{h['name']} {h['latest']}" for h in bv["heads"][:3]],
            "roadmap_vs_capex": [f"{x['fy']}: roadmap {x['roadmap'][0]}-{x['roadmap'][1]} vs capex {x['capex']}" for x in bv["afford"]]}


def budget_insights(b: dict) -> dict:
    bv = b["analysis"]
    lt, per = bv["latest"], bv["per_fy"]
    lo, hi = bv["benchmark"]
    nxt = next((x for x in per if not x["actual"]), per[-1])
    pos = "below" if (lt["pct_revenue"] or 0) < lo else "above" if (lt["pct_revenue"] or 0) > hi else "within"
    fast = max(bv["heads"], key=lambda h: h["growth"] or -999) if bv["heads"] else None
    inputs = [
        {"text": f"{len(b['inputs']['capex'])} capex initiatives and {len(b['inputs']['opex'])} opex cost heads across {len(per)} years "
                 f"({sum(x['actual'] for x in per)} actual, {sum(not x['actual'] for x in per)} projected).", "rule": "input count"},
        {"text": ("Detail and totals reconcile within tolerance." if not bv["recon"] else "Reconcile: " + "; ".join(bv["recon"][:3]) + "."),
         "rule": "detail sum vs overall row"},
        {"text": f"{sum(bool(c.get('theme')) for c in b['inputs']['capex'])} of {len(b['inputs']['capex'])} capex lines are tagged to a roadmap initiative; "
                 f"{len({h.get('kind') for h in b['inputs']['opex']})} opex cost types are tracked.", "rule": "capex theme tags, opex cost types"},
    ]
    analysis = [
        {"text": f"{lt['fy']} IT spend ₹{lt['total']} Cr is {lt['pct_revenue']}% of revenue, {pos} the {lo}-{hi}% benchmark band.", "rule": "total / revenue"},
        {"text": f"Run vs change: {lt['run_share']}% run (opex + salaries), {lt['change_share']}% change (capex); "
                 f"{nxt['fy']} plans {nxt['change_share']}% change.", "rule": "capex / total"},
        {"text": f"IT spend grows at {bv['cagr']}% a year from {per[0]['fy']} to {per[-1]['fy']}; "
                 + (f"fastest-growing head is {fast['name']} (+{fast['growth']}%)." if fast else ""), "rule": "CAGR, head growth"},
    ]
    if bv["afford"]:
        x = bv["afford"][0]
        analysis.append({"text": f"Roadmap investment in {x['fy']} (₹{x['roadmap'][0]}-{x['roadmap'][1]} Cr) is {x['share'][0]}-{x['share'][1]}% "
                                 f"of planned IT capex (₹{x['capex']} Cr).", "rule": "roadmap FY budget / projected capex"})
    return {"inputs": inputs, "analysis": analysis}


def budget(s: Session) -> dict:
    state, r = ctx(s)
    b = state["budget"]
    out = {"plan": phase_plan(state, "budget"), "source": b.get("source", "assumed"),
           "inputs": {k: b.get(k, []) for k in ("fys", "overall", "capex", "opex", "factors")},
           "themes": [{"id": t["id"], "name": t["name"]} for t in state["cfg"]["themes"]],
           "kinds": ["software", "cloud", "infrastructure", "network", "workplace", "applications", "services", "security", "other"],
           "analysis": budget_view(state, r), "note": read_seed()["budget"]["_meta"]["note"]}
    out["insights"] = budget_insights(out)
    return out


# --------------------------------------------------------------------------- data & technology
def _data_architecture(state: dict, r: dict) -> dict:
    app = {a["id"]: a for a in state["apps"]}
    rows = {d["id"]: d for d in r["data_rows"]}
    ai = rules.data_readiness(state["vision"]["ai_initiatives"], r["data_rows"], state["cfg"])
    sources = sorted({d["sor"] for d in state["data"] if d["sor"]})
    analytics = sorted({c for d in state["data"] for c in d["consumers"] if app.get(c, {}).get("layer") == "Data & AI"})
    return {
        "sources": [{"id": a, "name": app[a]["name"] if a in app else a, "hosting": app.get(a, {}).get("hosting", "Unknown")} for a in sources],
        "domains": [{"id": d["id"], "name": short(d["name"]), "sor": d["sor"], "score": rows[d["id"]]["score"],
                     "band": rows[d["id"]]["band"], "pii": d["pii"], "privacy_risk": rows[d["id"]]["privacy_risk"]} for d in state["data"]],
        "analytics": [{"id": a, "name": app[a]["name"]} for a in analytics],
        "ai": [{"id": i["id"], "name": i["name"], "ready": i["ready"], "domains": i["depends_on_data_domains"]} for i in ai],
        "platforms": [p for p in state["tech"]["platforms"] if p["category"] in ("Database", "AI & analytics")],
        "edges": [{"from": d["sor"], "to": d["id"], "kind": "sor"} for d in state["data"] if d["sor"]]
                 + [{"from": d["id"], "to": c, "kind": "feeds"} for d in state["data"] for c in d["consumers"] if c in analytics]
                 + [{"from": dd, "to": i["id"], "kind": "ai"} for i in ai for dd in i["depends_on_data_domains"]],
    }


CHECK_TO_STATUS = {"pass": "ok", "partial": "partial", "fail": "missing", "unknown": "validate"}
REF_STATUSES = ("ok", "partial", "missing", "validate")


def ref_view(state: dict, vid: str, r: dict | None = None) -> dict | None:
    """A reference architecture view with live links: block status from its resilience check, mapped app names and
    dispositions, and apps hosted on a hosting block. Counts by status are plain counts over the blocks."""
    v = state["ref_views"].get(vid)
    if v is None:
        return None
    v = copy.deepcopy(v)
    chk = {c["id"]: c for c in state["tech"]["resilience_checks"] + state["tech"].get("engineering_checks", [])}
    disp = {a["id"]: a for a in (r or {}).get("app_rows", [])}
    L = labels(state["cfg"])
    apps = {a["id"]: a for a in state["apps"]}
    hosted = collections.defaultdict(list)
    for a in state["apps"]:
        hosted[a.get("hosting") or "Unknown"].append(a["id"])

    def enrich(b: dict) -> dict:
        if b.get("check") in chk:
            c = chk[b["check"]]
            b["status"], b["derived"] = CHECK_TO_STATUS.get(c["status"], "validate"), f"{c['id']} {c['status']}: {c['check']}"
        b["app_refs"] = [{"id": i, "name": apps[i]["name"], "disposition": disp.get(i, {}).get("disposition"),
                          "label": L.get(disp.get(i, {}).get("disposition"), "")} for i in b.get("apps", []) if i in apps]
        if b.get("hosting"):
            b["hosted"] = [{"id": i, "name": apps[i]["name"]} for i in hosted.get(b["hosting"], [])]
        return b

    blocks = []
    for ly in v["layers"]:
        for row in ly["rows"]:
            for b in row:
                blocks.append(enrich(b))
    for b in (v.get("aside") or {}).get("boxes", []):
        blocks.append(enrich(b))
    counts = collections.Counter(b["status"] for b in blocks)
    v["counts"] = {k: counts.get(k, 0) for k in REF_STATUSES} | {"total": len(blocks)}
    v["explain"] = xp(v["title"], [(k, str(counts.get(k, 0))) for k in REF_STATUSES],
                      f"{len(blocks)} building blocks; {counts.get('missing', 0)} do not exist, {counts.get('partial', 0)} have gaps",
                      "Status is the architect's rating; blocks linked to a resilience check take its status "
                      "(pass → no gap, partial → some gaps, fail → does not exist, unknown → validate)", "§35.6, §43")
    return v


def data_tech_insights(d: dict, state: dict) -> dict:
    """3-4 rule-derived insights per Data & Technology step."""
    dom = d["domains"]
    weak = sorted(dom, key=lambda x: x["computed"]["score"])[:3]
    risk = [short(x["name"]) for x in dom if x["computed"]["privacy_risk"]]
    no_owner = [short(x["name"]) for x in dom if not x["owner"]]
    out = {"data": [
        {"text": f"Average data-domain governance score is {d['kpis']['data_avg']}/100; weakest: "
                 + ", ".join(f"{short(x['name'])} ({x['computed']['score']})" for x in weak) + ".", "rule": "weighted domain score"},
        {"text": (f"{len(risk)} domains hold personal data without a privacy classification ({_names(risk, 3)}): a DPDP Act 2023 exposure."
                  if risk else "Every domain holding personal data is classified."), "rule": "pii and not classified"},
        {"text": (f"{len(no_owner)} domains have no named data owner: {_names(no_owner, 3)}." if no_owner else "Every data domain has a named owner."),
         "rule": "owner = false"},
        {"text": f"{sum(1 for m in d['matrix'] if any(c == 'sor' for c in m['cells'].values()))} applications act as a system of record "
                 f"across {len(dom)} domains.", "rule": "application / data matrix"}]}
    for key, tab in (("data_ref", "data_arch"), ("infra_ref", "infra")):
        v = d[key]
        if not v:
            continue
        c = v["counts"]
        blocks = [b for ly in v["layers"] for row in ly["rows"] for b in row] + (v.get("aside") or {}).get("boxes", [])
        by_layer = sorted(((ly["name"], sum(b["status"] in ("missing", "partial") for row in ly["rows"] for b in row)) for ly in v["layers"]),
                          key=lambda t: -t[1])
        missing = [b["name"] for b in blocks if b["status"] == "missing"]
        out[tab] = [
            {"text": f"{c['total']} building blocks: {c['ok']} without gaps, {c['partial']} with some gaps, {c['missing']} that do not exist"
                     + (f" and {c['validate']} to validate." if c["validate"] else "."), "rule": "count by block status"},
            {"text": f"Most gaps sit in {by_layer[0][0]} ({by_layer[0][1]}) and {by_layer[1][0]} ({by_layer[1][1]}).", "rule": "gap blocks by layer"},
            {"text": "Missing building blocks: " + _names(missing, 4) + ".", "rule": "status = does not exist"}]
        linked = [b for b in blocks if b.get("derived")]
        if linked:
            out[tab].append({"text": f"{len(linked)} block{'s' if len(linked) != 1 else ''} take{'' if len(linked) != 1 else 's'} {'their' if len(linked) != 1 else 'its'} status from the resilience checklist ("
                                     + ", ".join(b["check"] for b in linked) + "); updating a check updates the view.", "rule": "check link"})
    t = d["tech"]
    fails = [c["check"] for c in d["checks"] if c["status"] == "fail"]
    plat = d["platforms"]
    out["tech"] = [
        {"text": f"Resilience score {t['resilience_score']}/100 on known checks; {t['unknown']} checks are still unknown and become validation items.",
         "rule": "pass 100 · partial 50 · fail 0"},
        {"text": ("Failed checks: " + _names(fails, 3) + ".") if fails else "No resilience check has failed.", "rule": "status = fail"},
        {"text": f"{sum(p.get('lifecycle') == 'Unknown' for p in plat)} of {len(plat)} platforms have an unknown lifecycle; "
                 f"{sum(p.get('standard') == 'Non-Standard' for p in plat)} are non-standard.", "rule": "technology portfolio"}]
    # RFP assessment items 3 (obsolescence) and 10 (standardisation opportunities)
    old_p = [p["name"] for p in plat if p.get("lifecycle") in ("Ageing", "EOL < 24m") or p.get("standard") in ("Phasing-Out Standard", "Retired Standard")]
    old_a = [short(a["name"]) for a in state["apps"] if a.get("lifecycle") in ("Ageing", "EOL < 24m")]
    nonstd = [short(a["name"]) for a in state["apps"] if a.get("in_scope", True) and a.get("standards_class") == "Non-Standard"]
    out["tech"].append({"text": f"Obsolescence: {len(old_p)} platforms and {len(old_a)} applications are ageing or near end of life"
                                + (f" ({_names(old_p + old_a, 3)})" if old_p or old_a else "")
                                + f". Standardisation opportunity: {len(nonstd)} in-scope applications are non-standard"
                                + (f" ({_names(nonstd, 3)})." if nonstd else "."),
                        "rule": "lifecycle Ageing / EOL < 24m; standards class"})
    return out


def data_tech(s: Session) -> dict:
    state, r = ctx(s)
    rows = {d["id"]: d for d in r["data_rows"]}
    domains = [dict(d, computed=rows[d["id"]]) for d in state["data"]]
    apps_in_matrix = sorted({d["sor"] for d in state["data"] if d["sor"]} | {c for d in state["data"] for c in d["consumers"]})
    app_name = {a["id"]: a["name"] for a in state["apps"]}
    matrix = [{"app": a, "name": app_name.get(a, a),
               "cells": {d["id"]: ("sor" if d["sor"] == a else "consumer" if a in d["consumers"] else "")
                         for d in state["data"]}} for a in apps_in_matrix]
    checks = state["tech"]["resilience_checks"]
    plat = state["tech"]["platforms"]
    status = {c["id"]: c["status"] for c in checks}
    L = labels(state["cfg"])
    rowa = {a["id"]: a for a in r["app_rows"]}
    hosting = collections.defaultdict(list)
    for a in state["apps"]:
        hosting[a["hosting"]].append({"id": a["id"], "name": a["name"], "layer": a.get("layer"), "in_scope": a["in_scope"],
                                      "disposition": rowa[a["id"]]["disposition"], "label": L[rowa[a["id"]]["disposition"]]})
    zones = [dict(z, statuses=[{"id": c, "status": status.get(c, "unknown")} for c in z["checks"]])
             for z in state["tech"].get("security_zones", [])]
    eng = state["tech"].get("engineering_checks", [])
    bv = budget_view(state, r)
    infra_heads = [h for h in state["budget"].get("opex", []) if h.get("kind") in ("cloud", "infrastructure", "network", "security")]
    d = {
        "plan": phase_plan(state, "data_tech"),
        "data_ref": ref_view(state, "DATA-REF", r), "infra_ref": ref_view(state, "INFRA-REF", r),
        "engineering_checks": eng, "engineering": rules.engineering_score(eng, state["cfg"]),
        "landing_zones": state["tech"].get("landing_zones", []), "sites_source": state["tech"].get("sites_source", "deck"),
        "apps": [{"id": a["id"], "name": a["name"], "hosting": a.get("hosting")} for a in state["apps"]],
        "budget_fys": state["budget"].get("fys", []), "budget_infra": infra_heads,
        "options": {"mdm": ["none", "partial", "full"], "data_types": ["Master", "Transactional", "Reference", "Analytical", "Unstructured", "IoT / time-series", "Geospatial"],
                    "sensitivity": ["Public", "Internal", "Confidential", "Personal (DPDP)", "Restricted"],
                    "standards": ["Standard", "Provisional Standard", "Proposed Standard", "Phasing-Out Standard", "Non-Standard", "Retired Standard"],
                    "lifecycle": ["Current", "Ageing", "EOL < 24m", "Unknown"], "check": ["pass", "partial", "fail", "unknown"],
                    "location_types": ["Data centre", "DR", "Public cloud", "Managed cloud", "Edge / OT", "Edge / retail", "Office", "External"]},
        "domains": domains, "matrix": matrix, "bands": state["cfg"]["data_rules"]["bands"],
        "weights": state["cfg"]["data_rules"]["score_weights"],
        "facts": state["tech"]["facts"], "locations": state["tech"]["locations"], "platforms": plat,
        "network": state["tech"].get("network", []), "zones": zones, "identity_plane": state["tech"].get("identity_plane"),
        "hosting": [{"name": h, "location": HOST_LOC.get(h), "apps": v} for h, v in sorted(hosting.items(), key=lambda x: -len(x[1]))],
        "data_arch": _data_architecture(state, r),
        "checks": checks, "tech": r["tech"],
        "kpis": {"data_avg": round(st.mean(d["score"] for d in r["data_rows"])),
                 "privacy_risk": sum(d["privacy_risk"] for d in r["data_rows"]),
                 "resilience_score": r["tech"]["resilience_score"],
                 "to_validate": r["tech"]["unknown"] + sum(p.get("lifecycle") == "Unknown" for p in plat)},
        "explain": {
            "data_avg": data_avg_xp(r),
            "privacy_risk": xp("Privacy-risk domains", [(d["id"], d["name"]) for d in r["data_rows"] if d["privacy_risk"]],
                               f"{sum(d['privacy_risk'] for d in r['data_rows'])} domains",
                               "Holds personal data AND privacy/retention classification not set → impact 5, urgency 5 (DPDP Act 2023)",
                               "§23.6.2 Principle 15"),
            "resilience_score": r["tech"]["explain"],
            "to_validate": xp("Items to validate", [(c["id"], c["check"]) for c in checks if c["status"] == "unknown"]
                              + [(p["id"], f"{p['name']} lifecycle") for p in plat if p.get("lifecycle") == "Unknown"],
                              f"{r['tech']['unknown']} unknown checks + {sum(p.get('lifecycle') == 'Unknown' for p in plat)} platforms with unknown lifecycle",
                              "Unknowns are discovery items, never assumed to pass", "§48.5"),
        },
        "check_explain": {c["id"]: check_explain(c, state["cfg"]) for c in checks},
    }
    d["gap_register"] = r["registers"]["data_tech"]
    cy = state["tech"].get("cyber", {})
    cp = rules.cyber_posture(cy, state["cfg"])
    d["cyber"] = {"inputs": cy, "posture": cp, "options": {k: state["cfg"]["cyber_rules"][k] for k in ("functions", "tool_status", "compliance_status")}}
    d["insights"] = data_tech_insights(d, state)
    lbl = {c["id"]: c["control"] for c in cy.get("controls", [])}
    ml = {m["id"]: m["label"] for m in cy.get("metrics", [])}
    d["insights"]["cyber"] = [
        {"text": f"Cyber security score {cp['score']}/100 (mean control maturity {cp['mean']}); weakest function: {cp['lowest']}.", "rule": "(mean maturity − 1) / 4 × 100"},
        {"text": (f"{cp['counts']['weak']} of {cp['counts']['controls']} controls are at maturity ≤ {state['cfg']['cyber_rules']['weak_max']}: "
                  + _names([lbl[i] for i in cp["weak"]], 3) + ".") if cp["weak"] else "No control is below the target maturity.", "rule": "maturity ≤ weak_max"},
        {"text": (f"{cp['counts']['breaches']} security metrics are off target: " + _names([ml[i] for i in cp["breaches"]], 3) + ".")
                 if cp["breaches"] else "All security metrics are on target.", "rule": "value vs target"},
        {"text": f"{cp['counts']['tool_gaps']} tooling areas are missing or partial and {cp['counts']['open_compliance']} compliance obligations are open; each becomes a gap under Resilience & cyber security.",
         "rule": "tooling status, compliance status"}]
    d["insights"]["gaps"] = gap_insights(d["gap_register"], "data and technology")
    e = d["engineering"]
    fails = [c["check"] for c in eng if c["status"] == "fail"]
    d["insights"]["engineering"] = [
        {"text": f"Engineering practices score {e['score']}/100 on known checks; {e['unknown']} still to validate.", "rule": "pass 100 · partial 50 · fail 0"},
        {"text": ("Not in place: " + _names(fails, 3) + ".") if fails else "No engineering practice check has failed.", "rule": "status = fail"},
        {"text": "DevSecOps, IaC and observability gaps raise change risk for the farmer, dealer and data platforms planned in the roadmap.", "rule": "E02-E04, E08 vs TH1, TH4"}]
    doms = d["domains"]
    d["insights"]["inputs"] = [
        {"text": f"{len(doms)} data domains, {len(d['platforms'])} technology platforms, {len(d['locations'])} sites and {len(d['network'])} network links captured.", "rule": "input count"},
        {"text": f"{len({t for x in doms for t in x.get('data_types', [])})} data types across the domains; "
                 f"{sum(not x.get('steward') for x in doms)} domains have no data steward yet.", "rule": "data types, steward"},
        {"text": f"Personal data sits in {sum(bool(x.get('pii')) for x in doms)} domains; {sum(bool(x.get('pii')) and not x.get('classified') for x in doms)} are not yet classified.", "rule": "pii, classified"}]
    cloud = next((h for h in bv["heads"] if h["kind"] == "cloud"), None)
    if cloud and "infra" in d["insights"]:
        d["insights"]["infra"] = d["insights"]["infra"][:3] + [{"text": f"Cloud & hosting opex is ₹{cloud['latest']} Cr a year (+{cloud['growth']}% over the period) "
                                                                          f"while landing zones are only partly built; set cost guardrails with the Data & AI landing zone.", "rule": "IT Budget opex head"}]
    return d


# --------------------------------------------------------------------------- roadmap & governance
def roadmap(s: Session) -> dict:
    state, r = ctx(s)
    cfg = state["cfg"]
    theme_name = {t["id"]: t["name"] for t in cfg["themes"]}
    gaps = sorted((dict(g, theme_name=theme_name[g["theme"]]) for g in r["gaps"]), key=lambda g: -g["priority"])
    themes = {t["id"]: t for t in cfg["themes"]}
    nov = s.get(SettingOverride, "initiative_notes")
    notes = nov.value if nov else {}
    pri = {p["id"]: p for p in rules.prioritise(r["initiatives"], cfg)}
    capex_by_theme = collections.defaultdict(float)
    for c in state["budget"].get("capex", []):
        if c.get("theme"):
            capex_by_theme[c["theme"]] += sum(v for v in c["values"] if isinstance(v, (int, float)))
    inits = []
    for i in r["initiatives"]:
        t, n = themes[i["id"]], notes.get(i["id"], {})
        inits.append(dict(i, prio=pri[i["id"]], theme_focus=t.get("focus", []),
                          benefits=n.get("benefits", t.get("benefits", [])), risks=n.get("risks", t.get("risks", [])),
                          constraints=n.get("constraints", t.get("constraints", [])), notes_source="client" if n else "assumed",
                          kpis=n.get("kpis", ""), owner=n.get("owner", ""),
                          gap_list=[{"id": g["id"], "title": g["title"], "kind": KIND[g["kind"]], "priority": g["priority"], "ref": g["ref"],
                                     "severity": g.get("severity"), "register": g.get("register", KIND[g["kind"]])}
                                    for g in gaps if g["theme"] == i["id"]],
                          budget_capex=round(capex_by_theme.get(i["id"], 0), 1)))
    bv = budget_view(state, r)
    rov = s.get(SettingOverride, "repository")
    repo = {**cfg["governance"].get("repository", {}), **(rov.value if rov else {})}
    if rov:
        repo["source"] = "client"
    gov = cfg["governance"]
    acmm = [{"id": e["id"], "name": e["name"], "level": r["gov"]["levels"][e["id"]],
             "source": state["acmm_source"].get(e["id"], "assumed")} for e in gov["acmm_elements"]]
    decisions = [d.model_dump(mode="json") for d in s.exec(select(Decision).order_by(Decision.id))]
    pv = principles_view(s, state)
    out = {
        "plan": phase_plan(state, "roadmap"), "long_list": inits, "budget": {k: bv[k] for k in ("afford", "per_fy", "benchmark")},
        "repository": repo, "prio_cfg": cfg["prioritization"],
        "gaps": gaps, "initiatives": r["initiatives"], "waves": cfg["roadmap"]["waves"], "fy_budget": r["fy_budget"],
        "total_cr": r["total_cr"], "rate_card": {k: x for k, x in cfg["roadmap"]["rate_card_inr_cr"].items() if k != "XL"},
        "rate_card_note": cfg["roadmap"]["rate_card_note"], "start": cfg["roadmap"]["start"],
        "acmm": acmm, "acmm_levels": gov["acmm_levels"], "acmm_mean": r["gov"]["acmm_mean"], "arb": gov["arb"],
        "compliance_levels": gov["compliance_levels"], "compliance_ref": gov["compliance_levels_ref"],
        "decisions": decisions,
        "principles": [{"id": p["id"], "name": p["name"]} for p in pv["togaf"] + pv["cil"] if p["adopted"]],
        "kpis": {"gaps": len(gaps), "initiatives": len(r["initiatives"]), "total_cr": r["total_cr"],
                 "acmm_mean": r["gov"]["acmm_mean"]},
        "explain": {
            "gaps": xp("Gap register", [(KIND[k], str(n)) for k, n in collections.Counter(g["kind"] for g in gaps).items()],
                       f"{len(gaps)} gaps; {sum(g['priority'] >= 20 for g in gaps)} at priority ≥ 20",
                       "Every gap comes from the Business, Application or Data & Technology gap register, or ACMM governance; priority = impact × urgency from severity", "§27"),
            "initiatives": xp("Initiatives", [(f"{i['wave_id']} {i['id']}", f"{i['name']} · {i['gaps']} gaps · size {i['size']}")
                                              for i in r["initiatives"]],
                              f"{len(r['initiatives'])} initiatives from {len(gaps)} gaps",
                              "Gaps group into 10 themes; each theme with ≥ 1 gap becomes an initiative", "§28, §32"),
            "total_cr": total_xp(r), "acmm_mean": r["gov"]["explain"], "fy_budget": fy_xp(r),
        },
    }
    out["operating_model"] = operating_model(s, state, out, pv)
    out["insights"] = roadmap_insights(out)
    return out


def operating_model(s: Session, state: dict, rm: dict, pv: dict) -> dict:
    """EA operating model (roles and hierarchy, structure and forums, KPIs). KPIs with a `measure` show today's value from the data."""
    ov = s.get(SettingOverride, "operating_model")
    om = copy.deepcopy(ov.value if ov else state["cfg"]["governance"].get("operating_model", {}))
    om["source"] = "client" if ov else "assumed"
    apps = [a for a in state["apps"] if a.get("in_scope", True)]
    owned = sum(bool(str(a.get("business_owner", "")).strip()) for a in apps)
    repo = rm["repository"].get("ownership", [])
    l3 = [x for l1 in state["caps"]["capabilities"] for c in l1["children"] for x in c.get("l3", [])]
    answered = sum(1 for x in l3 if (state["surveys"].get(x["id"]) or {}).get("status") == "responded")
    high = sum(g.get("severity") == "High" for g in rm["gaps"])
    measures = {
        "acmm_mean": (f"{rm['acmm_mean']:.2f}", "Mean ACMM level across the 9 elements"),
        "decisions": (str(len(rm["decisions"])), "Entries in the decision log"),
        "apps_owned_pct": (f"{round(100 * owned / max(1, len(apps)))}%", f"{owned} of {len(apps)} in-scope applications name a business owner"),
        "repo_owned": (f"{sum(bool(o.get('owner')) for o in repo)} of {len(repo)}", "View families in the repository model with an owner"),
        "gaps_high": (str(high), f"High-severity gaps across the registers (of {len(rm['gaps'])})"),
        "principles": (str(pv["adopted"]), "CIL and TOGAF principles adopted"),
        "discovery_pct": (f"{round(100 * answered / max(1, len(l3)))}%", f"{answered} of {len(l3)} L3 questionnaires answered"),
    }
    for k in om.get("kpis", []):
        cur = measures.get(k.get("measure") or "")
        k["current"], k["basis"] = (cur if cur else ("", "Not measured in the tool yet; capture from the ARB log"))
    return om


def roadmap_insights(rm: dict) -> dict:
    ll, k = rm["long_list"], rm["kpis"]
    q = collections.Counter(i["prio"]["label"] for i in ll)
    top = sorted(ll, key=lambda i: i["prio"]["rank"])[:3]
    no_capex = [i["name"] for i in ll if not i["budget_capex"]]
    af = rm["budget"]["afford"]
    risky = sorted(ll, key=lambda i: -len(i["risks"]))[:2]
    low = [a["name"] for a in rm["acmm"] if a["level"] <= 1]
    return {
        "longlist": [
            {"text": f"{k['gaps']} gaps roll up into {len(ll)} initiatives costing ₹{fmt(k['total_cr'][0])}-{fmt(k['total_cr'][1])} Cr.", "rule": "gap → theme → initiative"},
            {"text": "Most gaps: " + ", ".join(f"{i['name']} ({i['gaps']})" for i in sorted(ll, key=lambda i: -i["gaps"])[:3]) + ".", "rule": "gaps per initiative"},
            {"text": (f"{len(no_capex)} initiatives have no matching line in the IT capex plan: {_names(no_capex, 3)}." if no_capex
                      else "Every initiative maps to a line in the IT capex plan."), "rule": "IT Budget capex theme"}],
        "priority": [
            {"text": "Quadrants: " + ", ".join(f"{n} {lbl.lower()}" for lbl, n in q.most_common()) + ".", "rule": "value ≥ split, effort ≤ split"},
            {"text": "Top of the list: " + "; ".join(f"{i['prio']['rank']}. {i['name']} ({i['prio']['label']})" for i in top) + ".", "rule": "quadrant, then value / effort"},
            {"text": "Highest-risk initiatives: " + "; ".join(f"{i['name']} ({len(i['risks'])} risks)" for i in risky) + ".", "rule": "risk register"}],
        "roadmap": [
            {"text": "Waves: " + "; ".join(f"{w['id']} {w['name']}: {sum(i['wave'] == n for i in ll)}" for n, w in enumerate(rm["waves"])) + ".", "rule": "wave rules + dependency push"},
            {"text": (f"{af[0]['fy']} roadmap investment ₹{af[0]['roadmap'][0]}-{af[0]['roadmap'][1]} Cr is {af[0]['share'][0]}-{af[0]['share'][1]}% "
                      f"of planned IT capex ₹{af[0]['capex']} Cr." if af else "Add projected capex on IT Budget to test affordability."), "rule": "roadmap FY / IT capex"},
            {"text": "Foundations first: " + ", ".join(i["name"] for i in ll if i["foundation"]) + ".", "rule": "foundation themes"}],
        "governance": [
            {"text": f"ACMM mean {rm['acmm_mean']}/5; elements at level ≤ 1: {_names(low, 3) if low else 'none'}.", "rule": "§51.3 ACMM"},
            {"text": f"{len(rm['decisions'])} architecture decisions recorded; {sum(d['status'] == 'Proposed' for d in rm['decisions'])} awaiting ARB approval.", "rule": "decision log"},
            {"text": f"{len(rm['repository'].get('ownership', []))} view families have a named owner and update cadence in the repository model.", "rule": "repository ownership"}],
    }


SCREENS = {"overview": overview, "approach": approach, "vision": vision, "business": business, "applications": applications,
           "data_tech": data_tech, "budget": budget, "roadmap": roadmap}


def tab_insights(s: Session, screen: str, tab: str) -> list[dict]:
    """Rule-derived insights for one tab of a screen (screens without per-tab insights return [])."""
    if screen in ("overview", "business", "applications", "data_tech", "roadmap", "budget"):
        return SCREENS[screen](s)["insights"].get(tab, [])
    return []


# --------------------------------------------------------------------------- prompt facts (computed outputs only)
def summary(s: Session, screen: str) -> dict:
    """Facts for the AI prompts of a screen, always with the IT cost baseline so every inference can use it."""
    out = _summary(s, screen)
    state, r = ctx(s)
    return dict(out, it_budget=budget_facts(state, r))


def _summary(s: Session, screen: str) -> dict:
    if screen == "budget":
        b = budget(s)
        return {"per_fy": [{k: x[k] for k in ("fy", "total", "opex", "salaries", "capex", "pct_revenue", "change_share")} for x in b["analysis"]["per_fy"]],
                "largest_heads": [f"{h['name']} {h['latest']} ({h['growth']}%)" for h in b["analysis"]["heads"][:5]],
                "reconciliation": b["analysis"]["recon"], "provenance": b["source"]}
    if screen == "overview":
        o = overview(s)
        return {"kpis": o["kpis"], "dispositions": o["dispositions"], "top_gaps": [g["title"] for g in o["top_gaps"]],
                "waves": [{w["id"]: [i["name"] for i in w["initiatives"]]} for w in o["waves"]],
                "adm_status": {a["phase"]: a["status"] for a in o["adm"]},
                "states": {m["label"]: m["values"] for m in o["states"]["metrics"]}}
    if screen == "approach":
        a = approach(s)
        p = a["plan"]
        return {"scope": a["scope_of_work"], "current_week": p.get("current_week"), "weeks": p.get("weeks"),
                "progress": p.get("progress"), "current_phase": a["current_phase"],
                "phases": [{"name": ph["name"], "weeks": f"W{ph['start_week']}-W{ph['end_week']}", "progress": ph["progress"],
                            "gate": ph["gate"]} for ph in a["phases"]]}
    if screen == "vision":
        v = vision(s)
        return {"drivers": [d["driver"] for d in v["drivers"]], "focus_areas": [f["name"] for f in v["focus_areas"]],
                "scope_out": v["scope"]["out_of_scope"], "principles_adopted": v["kpis"]["principles_adopted"],
                "principles_warning": v["principles"]["warning"],
                "guardrails": [g["name"] for g in v["guardrails"] if g.get("active", True)],
                "rationalization_rules_on": [x["name"] for x in v["rules"]["rules"] if x.get("enabled")],
                "ai_initiatives_not_ready": [{"name": i["name"], "blocking": [b["name"] for b in i["blocking"]]}
                                             for i in v["ai_initiatives"] if not i["ready"]],
                "vision_drafted": bool(v["vision_doc"]["vision_statement"]), "data_provenance": "mostly deck/public; scores assumed"}
    if screen == "business":
        b = business(s)
        return {"kpis": b["kpis"], "top_capability_gaps": [f"{g['ref']} {g['title']} (priority {g['priority']})" for g in b["gaps"][:8]],
                "weakest_l1": sorted(((l1["name"], round(st.mean(c["maturity"] for c in l1["children"] if c["assessed"]), 2))
                                      for l1 in b["l1"] if any(c["assessed"] for c in l1["children"])),
                                     key=lambda x: x[1])[:3],
                "technology_ai_ladder": {o["label"]: len(o["caps"]) for o in b["ladder"]},
                "discovery": b["discovery"]["rollup"], "analysed_l2": b["kpis"]["analysed_l2"],
                "alignment_avg": b["kpis"]["alignment_avg"],
                "provenance": "capability scores and demo discovery responses are assumed"}
    if screen == "applications":
        a = applications(s)
        return {"kpis": a["kpis"], "dispositions": {a["labels"][k]: v for k, v in a["kpis"]["dispositions"].items() if v},
                "needs_action": [f"{x['name']}: {x['computed']['rationale']}" for x in a["apps"]
                                 if x["computed"]["disposition"] in ACTIONS],
                "clusters": [f"{c['cap']} {c['cap_name']}: {', '.join(m['name'] for m in c['members'])} -> {c['survivor_name']}"
                             for c in a["clusters"]],
                "integration": {k: a["integration"][k] for k in ("count", "p2p_share", "manual")}, "provenance": "fit scores assumed",
                "technical_health": a["tech_health"]["counts"],
                "spof": [f"{x['name']}: {'; '.join(x['spof'])}" for x in a["tech_health"]["rows"] if x["spof"]][:6]}
    if screen == "data_tech":
        d = data_tech(s)
        return {"kpis": d["kpis"], "domain_scores": {x["name"]: x["computed"]["score"] for x in d["domains"]},
                "privacy_risk_domains": [x["name"] for x in d["domains"] if x["computed"]["privacy_risk"]],
                "domains_without_owner": [x["name"] for x in d["domains"] if not x["owner"]],
                "checks_not_passing": [f"{c['id']} {c['check']}: {c['status']}" for c in d["checks"] if c["status"] != "pass"],
                "engineering_score": d["engineering"]["score"],
                "engineering_not_passing": [f"{c['id']} {c['check']}: {c['status']}" for c in d["engineering_checks"] if c["status"] != "pass"]}
    if screen == "roadmap":
        rm = roadmap(s)
        return {"kpis": rm["kpis"], "initiatives": [f"{i['wave_id']} {i['id']} {i['name']} size {i['size']} gaps {i['gaps']} "
                                                    f"Rs {i['cost_cr'][0]}-{i['cost_cr'][1]} Cr" for i in rm["initiatives"]],
                "fy_budget_cr": rm["fy_budget"], "acmm_low": [a["name"] for a in rm["acmm"] if a["level"] <= 1],
                "decisions": len(rm["decisions"]), "top_gaps": [g["title"] for g in rm["gaps"][:5]],
                "prioritisation": [f"{i['prio']['rank']}. {i['name']} {i['prio']['label']}" for i in sorted(rm["long_list"], key=lambda i: i["prio"]["rank"])],
                "risks": {i["name"]: i["risks"] for i in rm["long_list"]}}

    return {}
