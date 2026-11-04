"""Cyber security posture from the cyber inputs: maturity per NIST CSF 2.0 function, an overall score, metrics off target,
missing tooling and open compliance obligations. Parameters: config `cyber_rules`. Pure function."""
from __future__ import annotations

import statistics as st

from .common import band, xp


def off_target(m: dict) -> bool:
    v, t = m.get("value"), m.get("target")
    if not isinstance(v, (int, float)) or not isinstance(t, (int, float)):
        return False
    return v < t if m.get("better", "higher") == "higher" else v > t


def cyber_posture(cyber: dict, cfg: dict) -> dict:
    p = cfg["cyber_rules"]
    controls = [c for c in cyber.get("controls", []) if isinstance(c.get("maturity"), int)]
    funcs = []
    for f in p["functions"]:
        vals = [c["maturity"] for c in controls if c["function"] == f]
        m = round(st.mean(vals), 2) if vals else None
        funcs.append({"name": f, "maturity": m, "band": band(m, cfg["capability_rules"]["heat_bands"]) if m is not None else None, "n": len(vals)})
    mean = st.mean(c["maturity"] for c in controls) if controls else None
    score = round(100 * (mean - 1) / 4) if mean is not None else None
    weak = [c for c in controls if c["maturity"] <= p["weak_max"]]
    breaches = [m for m in cyber.get("metrics", []) if off_target(m)]
    tool_gaps = [t for t in cyber.get("tooling", []) if t.get("status") in ("None", "Partial")]
    open_obl = [x for x in cyber.get("compliance", []) if x.get("status") != "Compliant"]
    lowest = min((f for f in funcs if f["maturity"] is not None), key=lambda f: f["maturity"], default=None)
    return {
        "functions": funcs, "score": score, "mean": round(mean, 2) if mean is not None else None,
        "weak": [c["id"] for c in weak], "breaches": [m["id"] for m in breaches], "tool_gaps": [t["id"] for t in tool_gaps],
        "open_compliance": [x["id"] for x in open_obl], "lowest": lowest["name"] if lowest else None,
        "counts": {"controls": len(controls), "weak": len(weak), "breaches": len(breaches), "tool_gaps": len(tool_gaps), "open_compliance": len(open_obl)},
        "explain": xp("Cyber security score",
                      [(f["name"], f"{f['maturity'] if f['maturity'] is not None else '–'} from {f['n']} controls") for f in funcs]
                      + [("Metrics off target", ", ".join(m["label"] for m in breaches) or "none"),
                         ("Tooling missing or partial", ", ".join(t["area"] for t in tool_gaps) or "none")],
                      f"Score {score if score is not None else 'n/a'}/100 (mean control maturity {mean:.2f})" if mean is not None else "No controls scored",
                      "Score = (mean control maturity − 1) / 4 × 100; a control at maturity ≤ "
                      f"{p['weak_max']} is a gap", f"§{p['togaf_ref']}"),
    }
