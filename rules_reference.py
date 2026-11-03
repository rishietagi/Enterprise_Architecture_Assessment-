"""
Reference implementation of every deterministic rule in the CIL EA Navigator.
Executable spec: backend/app/rules/* must reproduce these outputs exactly on the seed data
(tests/test_rules.py asserts the GOLDEN values printed by `python rules_reference.py`).

All parameters come from seed/config.json. Pure functions, no I/O except load_seed().
"""
from __future__ import annotations

import collections
import json
import statistics as st
from pathlib import Path

SIZES = ["S", "M", "L", "XL"]


def load_seed(seed_dir: str | Path = "seed") -> dict:
    d = Path(seed_dir)
    return {
        "vision": json.loads((d / "vision.json").read_text(encoding="utf-8")),
        "caps": json.loads((d / "capabilities.json").read_text(encoding="utf-8")),
        "apps": json.loads((d / "applications.json").read_text(encoding="utf-8"))["applications"],
        "data": json.loads((d / "data_domains.json").read_text(encoding="utf-8"))["domains"],
        "tech": json.loads((d / "technology.json").read_text(encoding="utf-8")),
        "cfg": json.loads((d / "config.json").read_text(encoding="utf-8")),
    }


def band(value: float, bands: list) -> str:
    for lo, hi, name in bands:
        if lo <= value < hi:
            return name
    return bands[-1][2]


def gap(kind, ref, title, impact, urgency, phase, togaf_ref):
    return {"kind": kind, "ref": ref, "title": title, "impact": impact, "urgency": urgency,
            "priority": impact * urgency, "adm_phase": phase, "togaf_ref": togaf_ref}

# ---------------- Phase B: capabilities ----------------


def assess_capabilities(caps: dict, cfg: dict):
    rows, gaps = [], []
    for l1 in caps["capabilities"]:
        for c in l1["children"]:
            m = st.mean(c["q"])
            rows.append({"id": c["id"], "l1": l1["name"], "name": c["name"], "maturity": round(m, 2),
                         "importance": c["importance"], "gap_score": round(c["importance"] - m, 2),
                         "band": band(m, cfg["capability_rules"]["heat_bands"]), "focus": c.get("focus")})
            if c["importance"] >= 4 and m <= 2.5:
                u = 5 if c.get("focus") else 3
                if m <= 1.5:
                    u = min(5, u + 1)
                gaps.append(gap("capability", c["id"], f"Low maturity: {c['name']}", c["importance"], u, "B", "27"))
    return rows, gaps

# ---------------- Phase C: applications ----------------


def rationalize(apps: list, cfg: dict):
    th = cfg["rationalization"]["threshold"]
    rows = []
    for a in apps:
        bf, tf = st.mean(a["bf"]), st.mean(a["tf"])
        if not a["in_scope"]:
            d = "Retain (out of scope)"
        else:
            d = {(True, True): "Invest", (True, False): "Migrate",
                 (False, True): "Tolerate", (False, False): "Eliminate"}[(bf >= th, tf >= th)]
            if a["lifecycle"] == "EOL < 24m" and d in ("Invest", "Tolerate"):
                d = "Migrate"
        rows.append({"id": a["id"], "name": a["name"], "business_fit": round(bf, 2), "technical_fit": round(tf, 2),
                     "disposition": d, "validate_lifecycle": a["lifecycle"] == "Unknown"})
    # duplication clusters
    by_cap = collections.defaultdict(list)
    for a in apps:
        if a["in_scope"]:
            for c in a["caps"]:
                by_cap[c].append(a)
    clusters = []
    bf_of = {r["id"]: r["business_fit"] for r in rows}
    for cap, members in sorted(by_cap.items()):
        if len(members) >= 2:
            survivor = sorted(members, key=lambda a: (bool(a["sor"]), bf_of[a["id"]]), reverse=True)[0]
            clusters.append({"cap": cap, "apps": [a["id"] for a in members], "survivor": survivor["id"]})
    gaps = []
    crit = {a["id"]: a["criticality"] for a in apps}
    for r in rows:
        if r["disposition"] in ("Migrate", "Eliminate"):
            gaps.append(gap("application", r["id"], f"{r['disposition']}: {r['name']}", crit[r["id"]],
                            4 if r["disposition"] == "Migrate" else 3, "C_APP", "28.2"))
    for cl in clusters:
        gaps.append(gap("duplication", cl["cap"], f"{len(cl['apps'])} apps serve {cl['cap']}", 4, 3, "C_APP", "27"))
    return rows, clusters, gaps

# ---------------- Phase C: data ----------------


def assess_data(domains: list, cfg: dict):
    r = cfg["data_rules"]
    w, mv = r["score_weights"], r["mdm_values"]
    rows, gaps = [], []
    for d in domains:
        s = (w["owner"] * d["owner"] + w["sor"] * bool(d["sor"]) + w["mdm"] * mv[d["mdm"]]
             + w["quality"] * st.mean(d["quality"]) / 5 + w["lineage"] * d["lineage"]
             + w["classified_if_pii"] * ((not d["pii"]) or d["classified"]))
        s = round(s)
        privacy_risk = d["pii"] and not d["classified"]
        rows.append({"id": d["id"], "name": d["name"], "score": s, "band": band(s, r["bands"]), "privacy_risk": privacy_risk})
        if s < 60 or not d["owner"] or privacy_risk:
            imp = 5 if privacy_risk else (4 if len(d["consumers"]) >= 3 else 3)
            gaps.append(gap("data", d["id"], f"Data domain not governed: {d['name']}", imp, 5 if privacy_risk else 3, "C_DATA", "10.4"))
    return rows, gaps

# ---------------- Phase D: technology ----------------


def assess_tech(tech: dict, cfg: dict):
    iu = cfg["tech_rules"]["impact_urgency"]
    scores = cfg["tech_rules"]["status_scores"]
    known = [scores[c["status"]] for c in tech["resilience_checks"] if scores[c["status"]] is not None]
    gaps = [gap("technology", c["id"], c["check"] if c["status"] != "unknown" else f"Validate: {c['check']}",
                *iu[c["status"]], "D", c["togaf_ref"])
            for c in tech["resilience_checks"] if c["status"] != "pass"]
    return {"resilience_score": round(st.mean(known)) if known else None,
            "unknown": sum(c["status"] == "unknown" for c in tech["resilience_checks"])}, gaps

# ---------------- Governance (Prelim / G / H) ----------------


def assess_governance(cfg: dict, levels: dict | None = None):
    els = cfg["governance"]["acmm_elements"]
    lv = {e["id"]: (levels or {}).get(e["id"], e["seed"]) for e in els}
    gaps = []
    for e in els:
        if lv[e["id"]] <= 1:
            gaps.append(gap("governance", e["id"], f"EA maturity: {e['name']}", 4, 4, "PRELIM", "51.3"))
        elif lv[e["id"]] == 2:
            gaps.append(gap("governance", e["id"], f"EA maturity: {e['name']}", 3, 3, "PRELIM", "51.3"))
    return {"acmm_mean": round(st.mean(lv.values()), 2), "levels": lv}, gaps

# ---------------- Phase E/F: roadmap ----------------


def theme_for(g: dict, seed: dict) -> str:
    themes = seed["cfg"]["themes"]
    k, ref = g["kind"], g["ref"]
    if k in ("capability", "duplication"):
        for t in themes:
            if ref in t.get("caps", []):
                return t["id"]
        return "TH9" if k == "capability" else "TH6"
    if k == "application":
        for t in themes:
            if ref in t.get("apps", []):
                return t["id"]
        app = next(a for a in seed["apps"] if a["id"] == ref)
        for t in themes:
            if t["id"] in ("TH1", "TH2") and set(app["caps"]) & set(t["caps"]):
                return t["id"]
        return "TH6"
    if k == "data":
        for t in themes:
            if ref in t.get("data", []):
                return t["id"]
        return "TH4"
    if k == "technology":
        for t in themes:
            if ref in t.get("tech", []):
                return t["id"]
        return "TH7"
    return "TH8"  # governance


def build_roadmap(gaps: list, seed: dict):
    cfg = seed["cfg"]
    themes = {t["id"]: t for t in cfg["themes"]}
    rc = cfg["roadmap"]["rate_card_inr_cr"]
    waves = cfg["roadmap"]["waves"]
    grouped = collections.defaultdict(list)
    for g in gaps:
        g["theme"] = theme_for(g, seed)
        grouped[g["theme"]].append(g)
    inits = {}
    for tid, gs in grouped.items():
        t = themes[tid]
        prio = max(g["priority"] for g in gs)
        si = SIZES.index(t["size"])
        if len(gs) <= 2:
            si = max(0, si - 1)
        if len(gs) >= 6:
            si = min(3, si + 1)
        size = SIZES[si]
        if size in ("S", "M") and prio >= 16:
            w = 0
        elif t.get("foundation"):
            w = 0 if size == "S" else 1
        elif prio >= 16:
            w = 1
        elif prio >= 9:
            w = 2
        else:
            w = 3
        inits[tid] = {"id": tid, "name": t["name"], "gaps": len(gs), "priority": prio, "size": size, "wave": w,
                      "depends_on": [d for d in t.get("depends_on", []) if d in grouped]}
    changed = True
    while changed:  # dependency push until stable
        changed = False
        for i in inits.values():
            for dep in i["depends_on"]:
                nw = min(3, max(i["wave"], inits[dep]["wave"] + 1))
                if nw != i["wave"]:
                    i["wave"], changed = nw, True
    fy = collections.defaultdict(lambda: [0.0, 0.0])
    for i in inits.values():
        lo, hi = rc[i["size"]]
        i["cost_cr"] = [lo, hi]
        i["wave_id"] = waves[i["wave"]]["id"]
        for y, share in waves[i["wave"]]["fy_split"].items():
            fy[y][0] += lo * share
            fy[y][1] += hi * share
    total = [sum(i["cost_cr"][0] for i in inits.values()), sum(i["cost_cr"][1] for i in inits.values())]
    return sorted(inits.values(), key=lambda i: (i["wave"], -i["priority"])), dict(sorted(fy.items())), total


def run_all(seed: dict):
    cap_rows, g1 = assess_capabilities(seed["caps"], seed["cfg"])
    app_rows, clusters, g2 = rationalize(seed["apps"], seed["cfg"])
    data_rows, g3 = assess_data(seed["data"], seed["cfg"])
    tech_sum, g4 = assess_tech(seed["tech"], seed["cfg"])
    gov_sum, g5 = assess_governance(seed["cfg"])
    gaps = g1 + g2 + g3 + g4 + g5
    inits, fy, total = build_roadmap(gaps, seed)
    return {"cap_rows": cap_rows, "app_rows": app_rows, "clusters": clusters, "data_rows": data_rows,
            "tech": tech_sum, "gov": gov_sum, "gaps": gaps, "initiatives": inits, "fy_budget": fy, "total_cr": total}


if __name__ == "__main__":
    import sys
    seed = load_seed(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent / "seed")
    r = run_all(seed)
    caps = r["cap_rows"]
    print("GOLDEN VALUES (seed data)")
    print(f"capabilities: {len(caps)} L2, avg maturity {st.mean(c['maturity'] for c in caps):.2f}, "
          f"bands {dict(collections.Counter(c['band'] for c in caps))}")
    print(f"dispositions: {dict(collections.Counter(a['disposition'] for a in r['app_rows']))}")
    print(f"duplication clusters: {len(r['clusters'])} -> " + ", ".join(f"{c['cap']}{c['apps']}=>{c['survivor']}" for c in r['clusters']))
    print(f"data scores: " + ", ".join(f"{d['id']}={d['score']}" for d in r['data_rows']))
    print(f"tech: {r['tech']}   governance ACMM mean: {r['gov']['acmm_mean']}")
    print(f"gaps: {len(r['gaps'])} {dict(collections.Counter(g['kind'] for g in r['gaps']))}")
    for i in r["initiatives"]:
        print(f"  {i['wave_id']} {i['id']:<5} {i['name'][:45]:<45} gaps={i['gaps']:<3} prio={i['priority']:<3} size={i['size']:<2} Rs {i['cost_cr'][0]}-{i['cost_cr'][1]} Cr")
    print(f"budget by FY (Rs Cr low-high): " + ", ".join(f"{k}: {v[0]:.1f}-{v[1]:.1f}" for k, v in r['fy_budget'].items()))
    print(f"total: Rs {r['total_cr'][0]:.1f}-{r['total_cr'][1]:.1f} Cr")
