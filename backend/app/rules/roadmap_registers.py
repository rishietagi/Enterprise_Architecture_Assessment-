"""Phase E/F from the gap registers: every gap in the Business, Application and Data & Technology registers (plus the
ACMM governance gaps) is mapped to its initiative; initiatives are sized, waved and costed from them.

Severity sets priority (config roadmap.severity_scores, impact × urgency), so the existing wave thresholds apply
unchanged. Size starts from the initiative's base size and steps up when it closes many high-severity gaps
(roadmap.size_up_high) or down when it closes very few. The original rule-based register (rules.build_roadmap,
the parity port of rules_reference.py) is kept and tested separately."""
from __future__ import annotations

import collections

from .common import SIZES, fmt, xp

DEFAULT_SEV = {"High": [5, 4], "Medium": [4, 3], "Low": [3, 2]}
SCREEN = {"business": "Business Architecture", "application": "Application Architecture", "data_tech": "Data & Technology", "governance": "EA governance"}

MAX_SIZE = 2  # register roadmap sizes are S / M / L only (XL is kept for the parity roadmap)


def _cap_theme(cfg: dict, cap: str | None, default: str = "TH9") -> str:
    if cap:
        for t in cfg["themes"]:
            if cap in t.get("caps", []):
                return t["id"]
    return default


def unify(registers: dict, governance_gaps: list[dict], cfg: dict) -> list[dict]:
    """One list of roadmap gaps from the three registers and the governance (ACMM) gaps."""
    sev = cfg["roadmap"].get("severity_scores", DEFAULT_SEV)
    tname = {t["id"]: t["name"] for t in cfg["themes"]}
    out = []

    def add(gid, kind, category, ref, title, severity, theme, adm, togaf, closes, desc):
        i, u = sev[severity]
        out.append({"id": gid, "kind": kind, "category": category, "ref": ref, "title": title, "description": desc,
                    "severity": severity, "impact": i, "urgency": u, "priority": i * u, "theme": theme, "adm_phase": adm,
                    "togaf_ref": togaf, "closes": closes, "register": SCREEN[kind],
                    "explain": xp(f"{gid} {title}", [("Register", SCREEN[kind]), ("Category", category), ("Severity", severity),
                                                      ("Grouped into", f"{theme} {tname.get(theme, '')}")],
                                  f"Priority {i} × {u} = {i * u}", "Severity sets impact × urgency (High 5×4, Medium 4×3, Low 3×2)",
                                  f"§{togaf}")})

    biz = registers["business"]
    tx_theme = {}
    for g in biz["transactional"]:
        l2 = (g.get("l2") or {}).get("id")
        th = _cap_theme(cfg, l2)
        tx_theme[g["id"]] = th
        add(g["id"], "business", "Process (L3)", (g.get("l3") or {}).get("id", l2), g["title"], g["severity"], th, "B", "27",
            [f"capability:{l2}"] if l2 else [], g["description"])
    for g in biz["thematic"]:
        rel = [tx_theme[x] for x in g.get("related", []) if x in tx_theme]
        l1 = (g.get("l1") or {}).get("id")
        th = collections.Counter(rel).most_common(1)[0][0] if rel else next(
            (t["id"] for t in cfg["themes"] if l1 and any(c.startswith(l1 + ".") for c in t.get("caps", []))), "TH9")
        add(g["id"], "business", f"Theme ({g.get('level', 'L1')})", l1 or (g.get("l0") or {}).get("id", ""), g["title"], g["severity"], th,
            "B", "27", [], g["description"])
    for g in registers["application"]["gaps"]:
        closes = []
        if g["id"].startswith("AG-") and "Disposition" in g["description"]:
            closes.append(f"application:{g['where']['id']}")
        if g["category"] == "Duplication":
            closes.append(f"duplication:{g['where']['id']}")
        add(g["id"], "application", g["category"], g["where"]["id"], g["title"], g["severity"], g["initiative"], "C_APP", "35.6.5",
            closes, g["description"])
    for g in registers["data_tech"]["gaps"]:
        wid = g["where"]["id"]
        closes = [f"data:{wid}"] if g["category"] == "Data" and g["id"].startswith("DG-") else \
                 [f"technology:{wid}"] if g["category"].startswith("Resilience") else []
        add(g["id"], "data_tech", g["category"], wid, g["title"], g["severity"], g["initiative"],
            "C_DATA" if g["category"] == "Data" else "D", "35.6.4" if g["category"] == "Data" else "35.6.6", closes, g["description"])
    for g in governance_gaps:
        s = "High" if g["priority"] >= 16 else "Medium" if g["priority"] >= 9 else "Low"
        add(g["id"], "governance", "EA governance", g["ref"], g["title"], s, "TH8", g["adm_phase"], g["togaf_ref"], [], g["title"])
    return out


def build(gaps: list[dict], cfg: dict):
    """Initiatives, FY budget and total from the unified gaps (same wave and cost rules as rules.roadmap)."""
    themes = {t["id"]: t for t in cfg["themes"]}
    rc = cfg["roadmap"]["rate_card_inr_cr"]
    waves = cfg["roadmap"]["waves"]
    up = cfg["roadmap"].get("size_up_high", 6)
    up_total = cfg["roadmap"].get("size_up_gaps", 12)
    grouped = collections.defaultdict(list)
    for g in gaps:
        grouped[g["theme"] if g["theme"] in themes else "TH9"].append(g)
    inits, trace = {}, {}
    for tid, gs in grouped.items():
        t = themes[tid]
        prio = max(g["priority"] for g in gs)
        high = sum(g["severity"] == "High" for g in gs)
        si = min(SIZES.index(t["size"]), MAX_SIZE)
        size_why = f"base {t['size']}" + (" (capped at L)" if t["size"] == "XL" else "")
        if len(gs) <= 2:
            si = max(0, si - 1)
            size_why += f"; {len(gs)} gaps ≤ 2 → one size smaller"
        if high >= up or len(gs) >= up_total:
            si = min(MAX_SIZE, si + 1)
            size_why += (f"; {high} high-severity gaps ≥ {up}" if high >= up else f"; {len(gs)} gaps ≥ {up_total}") + " → one size larger"
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
        by_reg = collections.Counter(g["register"] for g in gs)
        inits[tid] = {"id": tid, "name": t["name"], "gaps": len(gs), "high": high, "priority": prio, "size": size, "wave": w,
                      "depends_on": [d for d in t.get("depends_on", []) if d in grouped],
                      "focus": t.get("focus", []), "foundation": bool(t.get("foundation")),
                      "gap_ids": [g["id"] for g in sorted(gs, key=lambda g: -g["priority"])],
                      "closes": sorted({c for g in gs for c in g["closes"]}), "by_register": dict(by_reg)}
        trace[tid] = {"size_why": size_why, "wave_why": wave_why, "pushes": []}
    changed = True
    while changed:
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
            ("Gaps closed", f"{i['gaps']} ({', '.join(f'{k} {v}' for k, v in i['by_register'].items())}); {i['high']} high severity"),
            ("Priority", f"highest gap priority = {i['priority']}"),
            ("Size", f"{tr['size_why']} → {i['size']}"),
            ("Wave rule", tr["wave_why"]),
            ("Dependencies", "; ".join(tr["pushes"]) if tr["pushes"] else
             (f"after {', '.join(i['depends_on'])}, no push needed" if i["depends_on"] else "none")),
            ("Cost", f"rate card {i['size']} = ₹{fmt(lo)}–{fmt(hi)} Cr"),
            ("FY split", ", ".join(f"{y} {int(s * 100)}%" for y, s in waves[i["wave"]]["fy_split"].items())),
        ], f"{i['wave_id']} {waves[i['wave']]['name']} · ₹{fmt(lo)}–{fmt(hi)} Cr",
            "Gaps from the Business, Application and Data & Technology registers plus ACMM governance gaps; size adjusts by "
            "gap count and high-severity gaps; wave by size/priority/foundation, then pushed after dependencies (capped W3)",
            "§28, §32, §36.2.14")
    total = [sum(i["cost_cr"][0] for i in inits.values()), sum(i["cost_cr"][1] for i in inits.values())]
    return sorted(inits.values(), key=lambda i: (i["wave"], -i["priority"])), dict(sorted(fy.items())), total
