"""Phase D: resilience checklist score and gaps (port of rules_reference.assess_tech)."""
from __future__ import annotations

import statistics as st

from .common import gap, xp


def assess_tech(tech: dict, cfg: dict):
    iu = cfg["tech_rules"]["impact_urgency"]
    scores = cfg["tech_rules"]["status_scores"]
    checks = tech["resilience_checks"]
    known = [scores[c["status"]] for c in checks if scores[c["status"]] is not None]
    gaps = [gap("technology", c["id"], c["check"] if c["status"] != "unknown" else f"Validate: {c['check']}",
                *iu[c["status"]], "D", c["togaf_ref"],
                impact_why=f"status '{c['status']}' → {iu[c['status']][0]}",
                urgency_why=f"status '{c['status']}' → {iu[c['status']][1]}",
                trigger=f"Check status is '{c['status']}' (only 'pass' closes the check)")
            for c in checks if c["status"] != "pass"]
    counts = {s: sum(c["status"] == s for c in checks) for s in ("pass", "partial", "fail", "unknown")}
    score = round(st.mean(known)) if known else None
    explain = xp("Resilience score",
                 [(f"{c['id']} {c['check'][:48]}", f"{c['status']} → {scores[c['status']] if scores[c['status']] is not None else 'excluded'}")
                  for c in checks],
                 f"Score = mean of {len(known)} known checks = ({' + '.join(map(str, known))}) / {len(known)} = {score}"
                 if known else "No known checks",
                 "pass 100, partial 50, fail 0; unknown is excluded and becomes a 'Validate in discovery' gap",
                 "§48.5")
    return {"resilience_score": score, "unknown": counts["unknown"], "counts": counts, "explain": explain}, gaps


def check_explain(c: dict, cfg: dict) -> dict:
    iu = cfg["tech_rules"]["impact_urgency"]
    s = cfg["tech_rules"]["status_scores"][c["status"]]
    if c["status"] == "pass":
        res, rule = "Pass → contributes 100, no gap", "Only non-pass checks create gaps"
    else:
        i, u = iu[c["status"]]
        res = f"{c['status']} → score {s if s is not None else 'excluded'}; gap priority {i} × {u} = {i * u}"
        rule = "fail 4×4, partial 3×3, unknown 3×2 ('Validate in discovery')"
    return xp(f"{c['id']} {c['check']}", [("Status", c["status"]), ("Source", c.get("source", "assumed")),
                                          ("TOGAF checklist", f"§{c['togaf_ref']}")], res, rule, f"§{c['togaf_ref']}")
