"""Deterministic rules - the only source of scores, dispositions, gaps, waves and Rs figures.
Pure functions over seed-shaped dicts; parameters come from config (seed/config.json + Settings overrides)."""
from __future__ import annotations

from .capabilities import assess_capabilities, coverage, entanglement
from .data import assess_data, data_readiness
from .discovery import ALIGN_Q, STATUSES, infer_l2, quadrant, rollup, score_l3, status_of
from .gap_register import gap_register, l3_entanglement
from .governance import assess_governance
from .integration import assess_integration
from .rationalization import label, rationalize
from .roadmap import build_roadmap, theme_for
from .states import architecture_states
from .technology import assess_tech


def run_all(seed: dict, acmm_levels: dict | None = None) -> dict:
    cap_rows, g1 = assess_capabilities(seed["caps"], seed["cfg"])
    app_rows, clusters, g2 = rationalize(seed["apps"], seed["cfg"])
    data_rows, g3 = assess_data(seed["data"], seed["cfg"])
    tech_sum, g4 = assess_tech(seed["tech"], seed["cfg"])
    gov_sum, g5 = assess_governance(seed["cfg"], acmm_levels)
    gaps = g1 + g2 + g3 + g4 + g5
    inits, fy, total = build_roadmap(gaps, seed)
    out = {"cap_rows": cap_rows, "app_rows": app_rows, "clusters": clusters, "data_rows": data_rows,
           "tech": tech_sum, "gov": gov_sum, "gaps": gaps, "initiatives": inits, "fy_budget": fy, "total_cr": total}
    out["entanglement"] = entanglement(seed["caps"], seed["apps"], seed["cfg"])
    out["integration"] = assess_integration(seed.get("integrations", []), seed["apps"], seed.get("external", []), seed["cfg"])
    out["coverage"] = coverage(seed["caps"], seed.get("reference", []))
    out["states"] = architecture_states(out, seed)
    return out


__all__ = ["architecture_states", "assess_capabilities", "assess_data", "assess_governance", "assess_integration",
           "assess_tech", "build_roadmap", "coverage", "data_readiness", "entanglement", "gap_register", "infer_l2",
           "l3_entanglement", "label", "quadrant", "ALIGN_Q",
           "rationalize", "rollup", "run_all", "score_l3", "status_of", "theme_for", "STATUSES"]
