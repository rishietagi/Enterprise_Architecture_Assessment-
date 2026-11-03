"""Phase B gap register from current-state discovery. Pure functions over the catalogue and the L3 survey answers.

Transactional gaps sit on one L3 process and are described from its answers; thematic gaps are a weakness that
recurs across an L1 (or across L1s within an L0). Each carries a target-state hypothesis and a rule-based severity.
No baseline is assumed: only answered questionnaires produce gaps. Consultant edits are overlaid from `notes`."""
from __future__ import annotations

import collections
import math

from .common import fmt, xp
from .discovery import DIM_Q, score_l3

SEVERITIES = ("High", "Medium", "Low")
SHORT = {"P": "Process", "T": "Technology", "D": "Data", "I": "Integration"}
THEME_TEXT = {  # what a recurring weak dimension means across an area
    "P": "processes are not run the same way across plants, regions and entities",
    "T": "work is still largely manual or held in spreadsheets, email and messaging",
    "D": "the data these processes depend on is scattered and reconciled by hand",
    "I": "hand-offs between processes and systems are re-keyed or moved as files",
}


def _opt(qs: list[dict], qid: str, n: int) -> str:
    q = next((x for x in qs if x["id"] == qid), None)
    if not q or not q.get("options") or not 1 <= n <= len(q["options"]):
        return ""
    return q["options"][n - 1]


def _lc(s: str) -> str:
    return s[:1].lower() + s[1:] if s and not s[:2].isupper() else s


def _target_level(crit: int | None, cfg: dict) -> int:
    t = cfg["capability_rules"].get("target_maturity", {}).get(str(crit or 3), 3.0)
    return min(5, max(3, math.ceil(t)))


def _severity(crit: int | None, maturity: float, has_one: bool, cfg: dict) -> tuple[str, str]:
    r = cfg.get("gap_register", {})
    hi_crit, hi_mat = r.get("high_criticality_min", 4), r.get("high_maturity_max", 2.0)
    crit = crit or 0
    if crit >= hi_crit and (maturity <= hi_mat or (has_one and crit >= 5)):
        return "High", f"criticality {crit} ≥ {hi_crit} and maturity {fmt(maturity)} ≤ {fmt(hi_mat)} (or a dimension at 1 on criticality 5)"
    if crit >= hi_crit or (crit >= 3 and maturity <= hi_mat):
        return "Medium", f"criticality {crit} with maturity {fmt(maturity)}"
    return "Low", f"criticality {crit} with maturity {fmt(maturity)}"


def _clause(label: str, option: str) -> str:
    return f"{label}: {_lc(option).replace('; ', ', ')}"


def transactional_gaps(caps: dict, surveys: dict, cfg: dict, apps: dict) -> list[dict]:
    """One gap per answered L3 whose maturity is at or below the threshold or that has a dimension at level 1."""
    r = cfg.get("gap_register", {})
    mat_max, weak_max = r.get("l3_maturity_max", 2.5), r.get("weak_dimension_max", 2)
    l0 = {x["id"]: x["name"] for x in caps.get("l0", [])}
    out = []
    for l1 in caps["capabilities"]:
        for c in l1["children"]:
            for x in c.get("l3", []):
                sv = surveys.get(x["id"])
                sc = score_l3(x, sv, cfg)
                if not sc:
                    continue
                weak = [(DIM_Q[i], v) for i, v in enumerate(sc["q"]) if v <= weak_max]
                if sc["maturity"] > mat_max and not any(v == 1 for _, v in weak):
                    continue
                qs, ans = sv.get("questions") or [], sv.get("answers") or {}
                weak = weak or [(DIM_Q[min(range(4), key=lambda i: sc["q"][i])], min(sc["q"]))]
                weak.sort(key=lambda t: t[1])
                sysans = ans.get("systems") or {}
                named = [apps[a] for a in sysans.get("apps", []) if a in apps]
                tools = ", ".join(named + ([sysans["other"]] if sysans.get("other") else []))
                today = ". ".join(_clause(SHORT[d], _opt(qs, k, v)) for (d, k, _), v in weak if _opt(qs, k, v))
                desc = f"{today}." + (f" Tools in use: {tools}." if tools else " No system is named for this process.")
                if ans.get("context"):
                    desc += f" {ans['context'].rstrip('.')}."
                lvl = _target_level(sc["importance"], cfg)
                target = ". ".join(_clause(SHORT[d], _opt(qs, k, max(lvl, v + 1))) for (d, k, _), v in weak if _opt(qs, k, max(lvl, v + 1)))
                hyp = (f"{target}. Lifting {_lc(weak[0][0][2])} first should remove most of the manual effort "
                       f"in {_lc(x['name'].split(' (')[0])}.")
                sev, why = _severity(sc["importance"], sc["maturity"], any(v == 1 for _, v in weak), cfg)
                comments = (ans.get("comments") or {}) if isinstance(ans.get("comments"), dict) else {}
                out.append({
                    "id": f"TG-{x['id']}", "type": "transactional", "level": "L3",
                    "l0": {"id": l1.get("l0"), "name": l0.get(l1.get("l0"), "")}, "l1": {"id": l1["id"], "name": l1["name"]},
                    "l2": {"id": c["id"], "name": c["name"]}, "l3": {"id": x["id"], "name": x["name"]},
                    "title": f"{weak[0][0][2]} gap in {x['name']}", "dims": [k for (k, _, _), _ in weak],
                    "description": desc, "hypothesis": hyp, "severity": sev, "criticality": sc["importance"],
                    "owner": (sv.get("recipient") or {}).get("role") or x.get("owner") or c.get("owner", ""),
                    "evidence": [{"label": lbl, "answer": _opt(qs, k, v), "value": v} for (_, k, lbl), v in weak]
                                + ([{"label": "Owner's note", "answer": sv["note"], "value": None}] if sv.get("note") else [])
                                + [{"label": f"Comment · {k}", "answer": v, "value": None} for k, v in comments.items() if v],
                    "source": sv.get("source", "assumed"),
                    "explain": xp(f"Transactional gap: {x['id']} {x['name']}",
                                  [(lbl, f"{v} · {_opt(qs, k, v)}") for (_, k, lbl), v in weak]
                                  + [("Business criticality", str(sc["importance"])), ("Severity", f"{sev} · {why}")],
                                  f"{len(weak)} weak dimension{'s' if len(weak) != 1 else ''}; severity {sev}",
                                  f"Gap if L3 maturity ≤ {fmt(mat_max)} or any dimension at 1; weak = answer ≤ {weak_max}; "
                                  "target level from the business criticality", "§27, §8.4")})
    return out


def thematic_gaps(caps: dict, tx: list[dict], surveys: dict, cfg: dict) -> list[dict]:
    """A dimension that is weak in at least `theme_min` gap processes of one L1 (or in two or more L1s of one L0)."""
    r = cfg.get("gap_register", {})
    k_min = r.get("theme_min", 2)
    answered = collections.Counter()
    for l1 in caps["capabilities"]:
        for c in l1["children"]:
            answered[l1["id"]] += sum(1 for x in c.get("l3", []) if (surveys.get(x["id"]) or {}).get("status") == "responded")
    by = collections.defaultdict(list)
    for g in tx:
        for d in g["dims"]:
            by[(g["l1"]["id"], d)].append(g)
    label = {k: lbl for k, _, lbl in DIM_Q}
    qid = {k: q for k, q, _ in DIM_Q}
    out, l1_themes = [], collections.defaultdict(list)
    for (l1id, d), gs in sorted(by.items(), key=lambda t: (-len(t[1]), t[0])):
        if len(gs) < k_min:
            continue
        l1, l0 = gs[0]["l1"], gs[0]["l0"]
        high = sum(g["severity"] == "High" for g in gs)
        sev = "High" if high >= 2 and len(gs) >= 3 else "Medium" if high or len(gs) >= 3 else "Low"
        names = [g["l3"]["name"] for g in gs]
        sv = surveys[gs[0]["l3"]["id"]]
        common = collections.Counter(e["answer"] for g in gs for e in g["evidence"] if e["label"] == label[d]).most_common(1)
        target = _lc(_opt(sv.get("questions") or [], qid[d], 4))
        gid = f"TH-{l1id}-{d}"
        l1_themes[(l0["id"], d)].append(l1)
        out.append({
            "id": gid, "type": "thematic", "level": "L1", "l0": l0, "l1": l1, "l2": None, "l3": None,
            "title": f"{label[d]} across {l1['name']}", "dims": [d],
            "description": (f"Across {l1['name']}, {THEME_TEXT[d]}: {len(gs)} of {answered[l1id]} surveyed processes "
                            f"({', '.join(names[:4])}{' and more' if len(names) > 4 else ''}) report it"
                            + (f", most often as '{_lc(common[0][0])}'." if common else ".")),
            "hypothesis": (f"Target state: {target}, delivered once for {l1['name']} as a shared capability rather than "
                           "fixed process by process."),
            "severity": sev, "criticality": max((g["criticality"] or 0) for g in gs),
            "owner": "", "related": [g["id"] for g in gs], "evidence": [{"label": g["l3"]["name"], "answer": g["title"], "value": None} for g in gs],
            "source": "client" if any(g["source"] == "client" for g in gs) else "assumed",
            "explain": xp(f"Thematic gap: {l1['name']} · {label[d]}", [(g["l3"]["id"], f"{g['l3']['name']} · {g['severity']}") for g in gs],
                          f"{len(gs)} transactional gaps share {label[d].lower()}; severity {sev}",
                          f"Theme if ≥ {k_min} L3 gaps in one L1 share a weak dimension; High if ≥ 3 or two High gaps", "§27")})
    for (l0id, d), l1s in l1_themes.items():
        if len(l1s) < 2:
            continue
        l0 = next(g["l0"] for g in out if g["l0"]["id"] == l0id)
        rel = [g for g in out if g["l0"]["id"] == l0id and g["dims"] == [d]]
        out.append({
            "id": f"TH-{l0id}-{d}", "type": "thematic", "level": "L0", "l0": l0, "l1": None, "l2": None, "l3": None,
            "title": f"{label[d]} across {l0['name']}", "dims": [d],
            "description": f"The same weakness recurs in {len(l1s)} L1 areas of {l0['name']} ({', '.join(x['name'] for x in l1s)}): {THEME_TEXT[d]}.",
            "hypothesis": f"Target state: one enterprise approach to {label[d].lower()} for {l0['name']}, set as an architecture standard and funded as a foundation initiative.",
            "severity": "High" if all(g["severity"] == "High" for g in rel) else "Medium",
            "criticality": max(g["criticality"] for g in rel), "owner": "", "related": [g["id"] for g in rel],
            "evidence": [{"label": g["l1"]["name"], "answer": g["title"], "value": None} for g in rel],
            "source": "client" if any(g["source"] == "client" for g in rel) else "assumed",
            "explain": xp(f"Thematic gap: {l0['name']} · {label[d]}", [(g["l1"]["id"], g["title"]) for g in rel],
                          f"Recurs in {len(l1s)} L1 areas", "L0 theme if the same L1 theme appears in two or more L1s", "§27")})
    return out


def l3_entanglement(caps: dict, surveys: dict, l2_nodes: list[dict], apps: dict) -> dict:
    """L3 drill-down of entanglement: each L3 inherits its L2's dependencies and is coupled to other L3s that run on
    the same applications (from the 'systems' discovery answer)."""
    l2 = {n["id"]: n for n in l2_nodes}
    uses = {}
    for l1 in caps["capabilities"]:
        for c in l1["children"]:
            for x in c.get("l3", []):
                sv = surveys.get(x["id"]) or {}
                got = ((sv.get("answers") or {}).get("systems") or {}).get("apps", []) if sv.get("status") == "responded" else []
                uses[x["id"]] = {"id": x["id"], "name": x["name"], "l2": c["id"], "apps": [a for a in got if a in apps],
                                 "answered": sv.get("status") == "responded"}
    by_app = collections.defaultdict(list)
    for u in uses.values():
        for a in u["apps"]:
            by_app[a].append(u["id"])
    out = collections.defaultdict(list)
    for u in uses.values():
        peers = sorted({p for a in u["apps"] for p in by_app[a] if p != u["id"]})
        cross = [p for p in peers if uses[p]["l2"] != u["l2"]]
        n = l2.get(u["l2"]) or {"upstream": [], "downstream": []}
        score = len(cross) + len(n["upstream"]) + len(n["downstream"])
        out[u["l2"]].append(dict(u, app_names=[apps[a] for a in u["apps"]],
                                 shared=[{"id": p, "name": uses[p]["name"], "l2": uses[p]["l2"],
                                          "apps": sorted(set(u["apps"]) & set(uses[p]["apps"]))} for p in peers],
                                 cross=len(cross), score=score if u["answered"] else None,
                                 explain=xp(f"L3 entanglement: {u['id']} {u['name']}",
                                            [("Systems named in discovery", ", ".join(apps[a] for a in u["apps"]) or "none"),
                                             ("L3 in other L2s on the same systems", ", ".join(cross) or "none"),
                                             ("Parent L2 dependencies", f"{len(n['upstream'])} upstream, {len(n['downstream'])} downstream")],
                                            f"Score = {len(cross)} + {len(n['upstream'])} + {len(n['downstream'])} = {score}"
                                            if u["answered"] else "No discovery answer yet",
                                            "Cross-L2 L3s sharing a system + the parent L2's upstream and downstream dependencies", "§27, §35.6.3")))
    return dict(out)


def gap_register(caps: dict, surveys: dict, cfg: dict, apps: dict, notes: dict | None = None) -> dict:
    notes = notes or {}
    tx = transactional_gaps(caps, surveys, cfg, apps)
    th = thematic_gaps(caps, tx, surveys, cfg)
    for g in tx + th:
        n = notes.get(g["id"]) or {}
        g["generated"] = {k: g[k] for k in ("description", "hypothesis", "severity")}
        for k in ("description", "hypothesis", "severity"):
            if n.get(k):
                g[k] = n[k]
        g["edited"] = any(n.get(k) and n[k] != g["generated"][k] for k in ("description", "hypothesis", "severity"))
        if g["edited"]:
            g["source"] = "client"
    order = {s: i for i, s in enumerate(SEVERITIES)}
    tx.sort(key=lambda g: (order[g["severity"]], g["l3"]["id"]))
    th.sort(key=lambda g: (order[g["severity"]], g["level"], g["id"]))
    c = collections.Counter(g["severity"] for g in tx + th)
    return {"transactional": tx, "thematic": th, "severities": list(SEVERITIES),
            "counts": {"transactional": len(tx), "thematic": len(th), **{s: c.get(s, 0) for s in SEVERITIES}}}
