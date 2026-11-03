"""Phase E/F: gap -> theme -> initiative, wave assignment and Rs budget (port of rules_reference.build_roadmap)."""
from __future__ import annotations

import collections

from .common import SIZES, fmt, xp


def theme_with_reason(g: dict, seed: dict) -> tuple[str, str]:
    themes = seed["cfg"]["themes"]
    k, ref = g["kind"], g["ref"]
    if k in ("capability", "duplication"):
        for t in themes:
            if ref in t.get("caps", []):
                return t["id"], f"{ref} is listed in {t['id']} capabilities"
        return ("TH9", f"{ref} not in a themed capability list → default TH9") if k == "capability" else \
               ("TH6", f"{ref} not in a themed capability list → default TH6 consolidation")
    if k == "application":
        for t in themes:
            if ref in t.get("apps", []):
                return t["id"], f"{ref} is listed in {t['id']} applications"
        app = next(a for a in seed["apps"] if a["id"] == ref)
        for t in themes:
            if t["id"] in ("TH1", "TH2") and set(app["caps"]) & set(t["caps"]):
                shared = ", ".join(sorted(set(app["caps"]) & set(t["caps"])))
                return t["id"], f"{ref} serves {shared}, which belongs to {t['id']}"
        return "TH6", f"{ref} has no themed capability → default TH6 consolidation"
    if k == "data":
        for t in themes:
            if ref in t.get("data", []):
                return t["id"], f"{ref} is listed in {t['id']} data domains"
        return "TH4", f"{ref} → default TH4 data foundation"
    if k == "technology":
        for t in themes:
            if ref in t.get("tech", []):
                return t["id"], f"{ref} is listed in {t['id']} technology checks"
        return "TH7", f"{ref} → default TH7 resilience"
    return "TH8", "Governance gaps → TH8 EA governance"


def theme_for(g: dict, seed: dict) -> str:
    return theme_with_reason(g, seed)[0]


def build_roadmap(gaps: list, seed: dict):
    cfg = seed["cfg"]
    themes = {t["id"]: t for t in cfg["themes"]}
    rc = cfg["roadmap"]["rate_card_inr_cr"]
    waves = cfg["roadmap"]["waves"]
    grouped = collections.defaultdict(list)
    for g in gaps:
        g["theme"], why = theme_with_reason(g, seed)
        g["explain"]["lines"].append({"label": "Grouped into", "value": f"{g['theme']} · {why}"})
        grouped[g["theme"]].append(g)
    inits, trace = {}, {}
    for tid, gs in grouped.items():
        t = themes[tid]
        prio = max(g["priority"] for g in gs)
        si = SIZES.index(t["size"])
        size_why = f"base {t['size']}"
        if len(gs) <= 2:
            si = max(0, si - 1)
            size_why += f"; {len(gs)} gaps ≤ 2 → one size smaller"
        if len(gs) >= 6:
            si = min(3, si + 1)
            size_why += f"; {len(gs)} gaps ≥ 6 → one size larger"
        size = SIZES[si]
        if size in ("S", "M") and prio >= 16:
            w, wave_why = 0, f"size {size} and priority {prio} ≥ 16 → W0 quick win"
        elif t.get("foundation"):
            w = 0 if size == "S" else 1
            wave_why = f"foundation theme, size {size} → W{w}"
        elif prio >= 16:
            w, wave_why = 1, f"priority {prio} ≥ 16 → W1"
        elif prio >= 9:
            w, wave_why = 2, f"priority {prio} in 9-15 → W2"
        else:
            w, wave_why = 3, f"priority {prio} < 9 → W3"
        inits[tid] = {"id": tid, "name": t["name"], "gaps": len(gs), "priority": prio, "size": size, "wave": w,
                      "depends_on": [d for d in t.get("depends_on", []) if d in grouped],
                      "focus": t.get("focus", []), "foundation": bool(t.get("foundation")),
                      "gap_ids": [g["id"] for g in sorted(gs, key=lambda g: -g["priority"])]}
        trace[tid] = {"size_why": size_why, "wave_why": wave_why, "pushes": []}
    changed = True
    while changed:  # dependency push until stable
        changed = False
        for i in inits.values():
            for dep in i["depends_on"]:
                nw = min(3, max(i["wave"], inits[dep]["wave"] + 1))
                if nw != i["wave"]:
                    trace[i["id"]]["pushes"].append(f"after {dep} (W{inits[dep]['wave']}) → W{nw}")
                    i["wave"], changed = nw, True
    fy = collections.defaultdict(lambda: [0.0, 0.0])
    for i in inits.values():
        lo, hi = rc[i["size"]]
        i["cost_cr"] = [lo, hi]
        i["wave_id"] = waves[i["wave"]]["id"]
        i["fy_split"] = {}
        for y, share in waves[i["wave"]]["fy_split"].items():
            fy[y][0] += lo * share
            fy[y][1] += hi * share
            i["fy_split"][y] = [lo * share, hi * share]
        tr = trace[i["id"]]
        i["explain"] = xp(f"{i['id']} {i['name']}", [
            ("Gaps grouped", f"{i['gaps']} (see gap register)"),
            ("Priority", f"max gap priority = {i['priority']}"),
            ("Size", f"{tr['size_why']} → {i['size']}"),
            ("Wave rule", tr["wave_why"]),
            ("Dependencies", "; ".join(tr["pushes"]) if tr["pushes"] else
             (f"after {', '.join(i['depends_on'])}, no push needed" if i["depends_on"] else "none")),
            ("Cost", f"rate card {i['size']} = ₹{fmt(lo)}–{fmt(hi)} Cr"),
            ("FY split", ", ".join(f"{y} {int(s * 100)}%" for y, s in waves[i["wave"]]["fy_split"].items())),
        ], f"{i['wave_id']} {waves[i['wave']]['name']} · ₹{fmt(lo)}–{fmt(hi)} Cr",
            "Size adjusts by gap count; wave by size/priority/foundation, then pushed after dependencies (capped W3)",
            "§28, §32, §36.2.14")
    total = [sum(i["cost_cr"][0] for i in inits.values()), sum(i["cost_cr"][1] for i in inits.values())]
    return sorted(inits.values(), key=lambda i: (i["wave"], -i["priority"])), dict(sorted(fy.items())), total
