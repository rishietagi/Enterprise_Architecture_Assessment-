"""Gap registers for Application Architecture and Data & Technology, in the same shape as the business gap register:
item gaps (one per application, data domain, check or platform, combining every issue found) and portfolio gaps
(themes that recur across the estate), each with a severity, a description, a target-state hypothesis and the roadmap
initiative that closes it. Consultant edits are overlaid without changing the rule output."""
from __future__ import annotations

import collections

from .common import xp

SEVERITIES = ("High", "Medium", "Low")
ACTION_TEXT = {"Migrate": "Modernise", "Eliminate": "Replace", "Consolidate": "Consolidate"}


def _sev(*levels: str) -> str:
    return next((s for s in SEVERITIES if s in levels), "Low")


def _theme(cfg: dict, key: str, ref: str, default: str) -> str:
    return next((t["id"] for t in cfg["themes"] if ref in t.get(key, [])), default)


def _gap(gid, scope, category, where, title, issues, hypothesis, severity, initiative, ref="§27"):
    return {"id": gid, "scope": scope, "category": category, "where": where, "title": title,
            "description": "; ".join(issues) + ".", "hypothesis": hypothesis, "severity": severity, "initiative": initiative,
            "evidence": issues,
            "explain": xp(f"{gid} {title}", [(f"Finding {i + 1}", x) for i, x in enumerate(issues)],
                          f"Severity {severity}", "One gap per item combining every rule that fired; severity is the highest of them", ref)}


def finish(gaps: list[dict], notes: dict, cfg: dict) -> dict:
    themes = {t["id"]: t["name"] for t in cfg["themes"]}
    for g in gaps:
        n = notes.get(g["id"]) or {}
        g["generated"] = {k: g[k] for k in ("description", "hypothesis", "severity")}
        for k in ("description", "hypothesis", "severity"):
            if n.get(k):
                g[k] = n[k]
        g["edited"] = any(n.get(k) and n[k] != g["generated"][k] for k in ("description", "hypothesis", "severity"))
        g["initiative_name"] = themes.get(g["initiative"], "")
    order = {s: i for i, s in enumerate(SEVERITIES)}
    gaps.sort(key=lambda g: (g["scope"] != "portfolio", order[g["severity"]], g["id"]))
    c = collections.Counter(g["severity"] for g in gaps)
    cats = collections.Counter(g["category"] for g in gaps)
    return {"gaps": gaps, "severities": list(SEVERITIES), "categories": sorted(cats),
            "counts": {"item": sum(g["scope"] == "item" for g in gaps), "portfolio": sum(g["scope"] == "portfolio" for g in gaps),
                       **{s: c.get(s, 0) for s in SEVERITIES}, "by_category": dict(cats)}}


# --------------------------------------------------------------------------- applications
def application_gaps(apps: list[dict], app_rows: list[dict], clusters: list[dict], health: dict, l2s: list[dict],
                     integration: dict, ref_view: dict | None, labels: dict, cfg: dict, notes: dict | None = None) -> dict:
    crit_min = cfg["tech_health"]["critical_min"]
    rows = {a["id"]: a for a in app_rows}
    th = {h["id"]: h for h in health["rows"]}
    gaps = []
    for a in apps:
        if not a.get("in_scope", True):
            continue
        r, h, crit = rows[a["id"]], th.get(a["id"]), a.get("criticality", 3)
        issues, levels, hyp = [], [], []
        d = r["disposition"]
        if d in ACTION_TEXT:
            issues.append(f"Disposition {labels.get(d, d)}: {r.get('statement', '').rstrip('.')}")
            levels.append("High" if crit >= crit_min and d in ("Migrate", "Eliminate") else "Medium")
            hyp.append({"Migrate": "modernised on the target platform (cloud-ready, API-enabled)", "Eliminate": "replaced by a standard product",
                        "Consolidate": f"consolidated onto the cluster survivor"}[d])
        if h and h["debt_band"] == "High":
            issues.append(f"High technical debt ({h['debt']}/100)")
            levels.append("High" if crit >= crit_min else "Medium")
            hyp.append("custom code reduced and the platform brought onto a supported, standard version")
        if h and h["spof_status"] == "SPOF":
            issues.append("Single point of failure: " + "; ".join(h["spof"]))
            levels.append("High" if crit >= crit_min else "Medium")
            hyp.append("resilient (tested DR or active-active) with no single-person dependency")
        if h and h["scal_status"] == "At risk":
            issues.append("Scalability at risk: " + "; ".join(h["scal"]))
            levels.append("High" if crit >= crit_min else "Medium")
            hyp.append("scales elastically through kharif and rabi peaks")
        if a.get("lifecycle") == "EOL < 24m":
            issues.append("Vendor support ends within 24 months")
            levels.append("High")
            hyp.append("moved to a supported release before end of life")
        if not issues:
            continue
        where = {"kind": "Application", "id": a["id"], "name": a["name"], "group": a.get("layer") or ""}
        gaps.append(_gap(f"AG-{a['id']}", "item", "Application", where, a["name"], issues,
                         f"{a['name'].split(' (')[0]} is " + "; ".join(dict.fromkeys(hyp)) + ".", _sev(*levels),
                         _theme(cfg, "apps", a["id"], "TH6"), "§35.6.5"))
    n = 0
    for c in clusters:
        n += 1
        names = [m["name"].split(" (")[0] for m in c["members"]]
        gaps.append(_gap(f"AT-{n:02d}", "portfolio", "Duplication", {"kind": "L2 capability", "id": c["cap"], "name": c["cap_name"], "group": "Portfolio"},
                         f"Overlapping applications for {c['cap_name']}", [f"{len(names)} applications serve {c['cap']} {c['cap_name']}: {', '.join(names)}"],
                         f"One application ({c['survivor_name'].split(' (')[0]}) serves {c['cap_name']}; the others are retired or folded in.",
                         "High" if len(names) >= 3 else "Medium", _theme(cfg, "caps", c["cap"], "TH6"), "§27"))
    bare = [c for c in l2s if not c["apps"] and not any(x["apps"] for x in c["l3"])]
    for c in bare:
        n += 1
        gaps.append(_gap(f"AT-{n:02d}", "portfolio", "Capability support", {"kind": "L2 capability", "id": c["id"], "name": c["name"], "group": "Portfolio"},
                         f"No application supports {c['name']}", [f"{c['id']} {c['name']} has no mapped application and no system named in discovery"],
                         f"{c['name']} runs on a supported application, standard or extended from the core, instead of spreadsheets and email.",
                         "High" if c.get("is_gap") else "Medium", _theme(cfg, "caps", c["id"], "TH9"), "§35.6.3"))
    hot = [h for h in integration["hotspots"]]
    if integration["p2p_share"] >= 50 or hot:
        n += 1
        gaps.append(_gap(f"AT-{n:02d}", "portfolio", "Integration", {"kind": "Interface Catalog", "id": "I", "name": "Integration estate", "group": "Portfolio"},
                         "Point-to-point integration", [f"{integration['p2p_share']}% of {integration['count']} interfaces are point-to-point",
                                                        f"{integration['manual']} manual hand-offs"] + ([f"Hotspots: {', '.join(h['name'].split(' (')[0] for h in hot[:4])}"] if hot else []),
                         "New and changed integrations run through a governed API and event layer with monitoring.",
                         "High" if integration["p2p_share"] >= 70 else "Medium", "TH5", "§35.6.5"))
    if ref_view:
        for ly in ref_view["layers"]:
            miss = [b["name"] for row in ly["rows"] for b in row if b["status"] == "missing"]
            if miss:
                n += 1
                gaps.append(_gap(f"AT-{n:02d}", "portfolio", "Missing building block", {"kind": "Architecture layer", "id": ly["id"], "name": ly["name"], "group": "Portfolio"},
                                 f"{ly['name']}: capabilities that do not exist", [f"Not in place: {', '.join(miss)}"],
                                 f"The {ly['name'].lower()} layer has these building blocks in place, prioritised by business value.",
                                 "High" if len(miss) >= 3 else "Medium", "TH4" if "Data" in ly["name"] else "TH5" if "Integration" in ly["name"] else "TH6", "§35.6.5"))
    return finish(gaps, notes or {}, cfg)


# --------------------------------------------------------------------------- data & technology
ENG_THEME = {"E03": "TH7", "E04": "TH7", "E08": "TH7", "E09": "TH7", "E10": "TH8"}


def data_tech_gaps(domains: list[dict], data_rows: list[dict], checks: list[dict], eng: list[dict], platforms: list[dict],
                   refs: list[dict], zones: list[dict], cfg: dict, notes: dict | None = None) -> dict:
    below = cfg["data_rules"].get("gap_score_below", 60)
    rows = {d["id"]: d for d in data_rows}
    gaps = []
    for d in domains:
        r = rows.get(d["id"])
        if not r:
            continue
        issues, levels = [], []
        if r["privacy_risk"]:
            issues.append("Holds personal data without a privacy and retention classification (DPDP Act 2023)")
            levels.append("High")
        if r["score"] < below:
            issues.append(f"Governance score {r['score']}/100, below {below}")
            levels.append("High" if r["score"] < 40 else "Medium")
        if not d.get("owner"):
            issues.append("No named business data owner")
            levels.append("Medium")
        if d.get("mdm") == "none":
            issues.append("No master data management")
            levels.append("Medium" if "Master" in d.get("data_types", []) else "Low")
        if not d.get("lineage"):
            issues.append("Lineage not documented")
            levels.append("Low")
        if not issues or (levels == ["Low"] and r["score"] >= below):
            continue
        name = d["name"].split(" (")[0]
        gaps.append(_gap(f"DG-{d['id']}", "item", "Data", {"kind": "Data domain", "id": d["id"], "name": name, "group": ", ".join(d.get("data_types", [])[:2])},
                         name, issues, f"{name} has a named owner and steward, mastered records, documented lineage and a privacy classification, "
                                       f"scoring at least {below}.", _sev(*levels), _theme(cfg, "data", d["id"], "TH4"), "§23.6.2, §34.6"))
    for c, kind in [(c, "Resilience & security") for c in checks] + [(c, "Engineering practice") for c in eng]:
        if c["status"] == "pass":
            continue
        sev = {"fail": "High", "partial": "Medium", "unknown": "Low"}[c["status"]]
        if kind == "Engineering practice" and sev == "High" and c["id"] not in ("E04", "E08"):
            sev = "Medium"
        txt = {"fail": "Not in place", "partial": "Partly in place", "unknown": "Status unknown; validate in discovery"}[c["status"]]
        theme = _theme(cfg, "tech", c["id"], "TH7") if kind.startswith("Resilience") else ENG_THEME.get(c["id"], "TH6")
        gaps.append(_gap(f"DG-{c['id']}", "item", kind, {"kind": "Check", "id": c["id"], "name": c["check"], "group": c.get("area", "§48.5")},
                         c["check"], [f"{txt} ({c['status']})"], f"In place and evidenced: {c['check'][0].lower() + c['check'][1:]}.", sev, theme, f"§{c.get('togaf_ref', '48.5')}"))
    for p in platforms:
        issues, levels = [], []
        if p.get("lifecycle") == "EOL < 24m":
            issues.append("Vendor support ends within 24 months")
            levels.append("High")
        elif p.get("lifecycle") == "Ageing":
            issues.append("Ageing platform")
            levels.append("Medium")
        elif p.get("lifecycle") == "Unknown":
            issues.append("Lifecycle unknown")
            levels.append("Low")
        if p.get("standard") in ("Non-Standard", "Phasing-Out Standard", "Retired Standard"):
            issues.append(f"Standards class: {p['standard']}")
            levels.append("Medium")
        if issues:
            gaps.append(_gap(f"DG-{p['id']}", "item", "Platform", {"kind": "Platform", "id": p["id"], "name": p["name"], "group": p.get("category", "")},
                             p["name"], issues, f"{p['name']} is on a current, supported release and classed as a standard.", _sev(*levels), "TH7", "§35.6.6"))
    n = 0
    for v in refs:
        for ly in v["layers"]:
            miss = [b["name"] for row in ly["rows"] for b in row if b["status"] == "missing"]
            if miss:
                n += 1
                gaps.append(_gap(f"DT-{n:02d}", "portfolio", "Missing building block", {"kind": v["kind"].capitalize() + " layer", "id": ly["id"], "name": ly["name"], "group": "Portfolio"},
                                 f"{ly['name']}: capabilities that do not exist", [f"Not in place: {', '.join(miss)}"],
                                 f"The {ly['name'].lower()} layer has these building blocks in place, sequenced by the roadmap.",
                                 "High" if len(miss) >= 3 else "Medium",
                                 "TH5" if "Integration" in ly["name"] else "TH4" if v["kind"] == "data" else "TH7", "§35.6.4, §35.6.6"))
    zmiss = [z["name"] for z in zones if z.get("status") in ("missing", "partial")]
    if zmiss:
        n += 1
        gaps.append(_gap(f"DT-{n:02d}", "portfolio", "Cloud", {"kind": "Landing zones", "id": "LZ", "name": "Azure landing zones", "group": "Portfolio"},
                         "Cloud landing zones incomplete", [f"Not complete: {', '.join(zmiss)}"],
                         "Azure landing zones are built as code with policy, identity, networking and cost guardrails before workloads move.",
                         "Medium", "TH7", "§35.6.6"))
    no_owner = [d["name"].split(" (")[0] for d in domains if not d.get("owner")]
    if len(no_owner) >= 2:
        n += 1
        gaps.append(_gap(f"DT-{n:02d}", "portfolio", "Data", {"kind": "Data governance", "id": "DG", "name": "Data ownership", "group": "Portfolio"},
                         "Data ownership not established", [f"{len(no_owner)} domains have no business owner: {', '.join(no_owner)}"],
                         "A data governance council names an owner and steward for every domain, with quality KPIs reviewed monthly.",
                         "High" if len(no_owner) >= 4 else "Medium", "TH4", "§23.6.2"))
    return finish(gaps, notes or {}, cfg)
