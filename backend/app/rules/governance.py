"""Governance (Preliminary / G / H): ACMM levels and gaps (port of rules_reference.assess_governance)."""
from __future__ import annotations

import statistics as st

from .common import gap, xp


def assess_governance(cfg: dict, levels: dict | None = None):
    els = cfg["governance"]["acmm_elements"]
    lv = {e["id"]: (levels or {}).get(e["id"], e["seed"]) for e in els}
    gaps = []
    for e in els:
        if lv[e["id"]] <= 1:
            gaps.append(gap("governance", e["id"], f"EA maturity: {e['name']}", 4, 4, "PRELIM", "51.3",
                            impact_why="level ≤ 1 → 4", urgency_why="level ≤ 1 → 4",
                            trigger=f"ACMM level {lv[e['id']]} ≤ 1"))
        elif lv[e["id"]] == 2:
            gaps.append(gap("governance", e["id"], f"EA maturity: {e['name']}", 3, 3, "PRELIM", "51.3",
                            impact_why="level 2 → 3", urgency_why="level 2 → 3", trigger="ACMM level 2"))
    mean = round(st.mean(lv.values()), 2)
    explain = xp("ACMM mean", [(e["name"], str(lv[e["id"]])) for e in els],
                 f"Mean = ({' + '.join(str(lv[e['id']]) for e in els)}) / {len(els)} = {mean}",
                 "Each element 0-5 (US DoC ACMM). Level ≤ 1 → 4×4 gap, level 2 → 3×3 gap.", "§51.3")
    return {"acmm_mean": mean, "levels": lv, "explain": explain}, gaps
