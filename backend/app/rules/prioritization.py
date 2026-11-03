"""Initiative prioritisation: value (highest gap priority, impact × urgency) against effort (size), in four quadrants.
Parameters: config `prioritization`. Does not change waves or cost; it explains them."""
from __future__ import annotations

from .common import xp


def prioritise(inits: list[dict], cfg: dict) -> list[dict]:
    p = cfg["prioritization"]
    q = p["quadrants"]
    out = []
    for i in inits:
        value, effort = i["priority"], p["effort"][i["size"]]
        hi_v, lo_e = value >= p["value_split"], effort <= p["effort_split"]
        key = "quick_win" if hi_v and lo_e else "strategic" if hi_v else "fill_in" if lo_e else "reconsider"
        score = round(value / effort, 1)
        out.append({"id": i["id"], "value": value, "effort": effort, "quadrant": key, "label": q[key], "score": score,
                    "explain": xp(f"{i['id']} prioritisation", [("Value", f"highest gap priority = {value} (impact × urgency)"),
                                                                 ("Effort", f"size {i['size']} → {effort}"),
                                                                 ("Gaps", str(i["gaps"]))],
                                  f"{q[key]} · value/effort = {score}",
                                  f"High value ≥ {p['value_split']}; low effort ≤ {p['effort_split']} (S=1, M=2, L=3, XL=4)",
                                  f"§{p['togaf_ref']}")})
    order = sorted(out, key=lambda x: (["quick_win", "strategic", "fill_in", "reconsider"].index(x["quadrant"]), -x["score"]))
    for n, x in enumerate(order, 1):
        x["rank"] = n
    return order


def engineering_score(checks: list[dict], cfg: dict) -> dict:
    """Engineering practices score on the same scale as the resilience checklist (pass 100, partial 50, fail 0)."""
    scores = cfg["tech_rules"]["status_scores"]
    known = [scores[c["status"]] for c in checks if scores.get(c["status"]) is not None]
    counts = {s: sum(c["status"] == s for c in checks) for s in ("pass", "partial", "fail", "unknown")}
    score = round(sum(known) / len(known)) if known else None
    return {"score": score, "counts": counts, "unknown": counts["unknown"],
            "explain": xp("Engineering practices score", [(f"{c['id']} {c['check'][:48]}", c["status"]) for c in checks],
                          f"Mean of {len(known)} known checks = {score}" if known else "No known checks",
                          "pass 100, partial 50, fail 0; unknown excluded (validate in discovery)", "§43, §48.5")}
