"""Technical health per application: technical debt score, single points of failure and scalability risk.
Inputs are the intake fields (customisation, lifecycle, standards class, self-assessed debt, technology currency, DR,
failover, key-person dependency, scalability, peak load, scaling model) plus the L3 discovery answers on peak load,
fallback and workarounds for processes that name the application. Parameters: config `tech_health`."""
from __future__ import annotations

import collections

from .common import xp


def _band(score: float, bands: list) -> str:
    return next(b for lo, b in bands if score >= lo)


def tech_health(apps: list[dict], surveys: dict, interfaces_degree: dict, hotspot_min: int, cfg: dict) -> dict:
    p = cfg["tech_health"]
    w, maps = p["debt_weights"], p["debt_maps"]
    crit_min, weak_dr, amax = p["critical_min"], set(p["weak_dr"]), p["process_answer_max"]
    # process evidence: L3 answers ≤ amax on peak / fallback / workarounds, attributed to every app the owner named
    ev = collections.defaultdict(lambda: {"peak": [], "fallback": [], "workarounds": []})
    for sid, sv in surveys.items():
        an = sv.get("answers") or {}
        if sv.get("status") not in ("responded", "analysed"):
            continue
        for a in (an.get("systems") or {}).get("apps", []):
            for k in ("peak", "fallback", "workarounds"):
                if isinstance(an.get(k), int) and an[k] <= amax:
                    ev[a][k].append(sid)
    rows = []
    for a in apps:
        parts, known = [], 0.0
        tc = a.get("tf", [3, 3, 3, 3])[0]
        vals = {"customisation": maps["customisation"].get(a.get("customisation")),
                "lifecycle": maps["lifecycle"].get(a.get("lifecycle")),
                "standards_class": maps["standards_class"].get(a.get("standards_class")),
                "tech_debt": maps["tech_debt"].get(a.get("tech_debt")),
                "tech_currency": round((5 - tc) * 0.75, 2) if isinstance(tc, (int, float)) else None}
        num = sum(w[k] * v / 3 for k, v in vals.items() if v is not None)
        den = sum(w[k] for k, v in vals.items() if v is not None)
        debt = round(100 * num / den) if den else None
        for k, v in vals.items():
            parts.append((k.replace("_", " ").capitalize(), f"{a.get(k) if k != 'tech_currency' else tc} → {v if v is not None else 'unknown, excluded'} × weight {w[k]}"))
        e = ev[a["id"]]
        if e["workarounds"] and debt is not None:
            debt = min(100, debt + 10)
            parts.append(("Discovery", f"{len(e['workarounds'])} L3 owners report frequent workarounds → +10"))
        crit = a.get("criticality", 3)
        spof, check = [], []
        if crit >= crit_min and a.get("dr") in weak_dr:
            spof.append(f"criticality {crit} with DR '{a.get('dr')}'")
        if crit >= crit_min and a.get("dr") in (None, "TBD"):
            check.append("DR arrangement not confirmed")
        if a.get("key_person") == "Yes":
            spof.append("depends on one key person or vendor resource")
        if crit >= crit_min and a.get("failover_tested") == "No" and a.get("dr") not in weak_dr:
            check.append("failover never tested")
        deg = interfaces_degree.get(a["id"], 0)
        if deg >= hotspot_min and a.get("dr") in weak_dr | {None, "TBD"}:
            spof.append(f"integration hub ({deg} interfaces) without resilient DR")
        if e["fallback"]:
            (spof if crit >= crit_min else check).append(
                f"{len(e['fallback'])} L3 processes have no tested fallback ({', '.join(e['fallback'][:3])})")
        scal = []
        if a.get("scalability") == "Low":
            scal.append("scalability rated Low")
        if a.get("peak_load", "").startswith(("Slows", "Fails")):
            scal.append(a["peak_load"].lower())
        if a.get("scale_model") == "Fixed capacity" and crit >= crit_min:
            scal.append("fixed capacity on a critical application")
        if e["peak"]:
            scal.append(f"{len(e['peak'])} L3 owners report peak-season slowdowns")
        rows.append({
            "id": a["id"], "name": a["name"], "criticality": crit, "in_scope": a.get("in_scope", True),
            "debt": debt, "debt_band": _band(debt, p["debt_bands"]) if debt is not None else None,
            "spof": spof, "spof_status": "SPOF" if spof else ("Check" if check else "OK"), "spof_checks": check,
            "scal": scal, "scal_status": "At risk" if len(scal) >= 2 or (scal and crit >= crit_min) else ("Watch" if scal else "OK"),
            "evidence": {k: v for k, v in e.items()},
            "explain": xp(f"{a['id']} technical health", parts + [("Single point of failure", "; ".join(spof + check) or "none found"),
                                                               ("Scalability", "; ".join(scal) or "no limitation reported")],
                          f"Technical debt {debt if debt is not None else 'n/a'}/100 · SPOF {'yes' if spof else 'no'} · scalability {'at risk' if scal else 'ok'}",
                          "Debt = weighted mean of mapped intake fields (0-3 scale) × 100; +10 when owners report frequent workarounds. "
                          "SPOF and scalability flags come from intake and L3 answers ≤ " + str(amax), f"§{p['togaf_ref']}"),
        })
    inscope = [r for r in rows if r["in_scope"]]
    debts = [r["debt"] for r in inscope if r["debt"] is not None]
    return {"rows": rows,
            "counts": {"high_debt": sum(r["debt_band"] == "High" for r in inscope), "spof": sum(r["spof_status"] == "SPOF" for r in inscope),
                       "spof_check": sum(r["spof_status"] == "Check" for r in inscope), "scal_risk": sum(r["scal_status"] == "At risk" for r in inscope),
                       "avg_debt": round(sum(debts) / len(debts)) if debts else None, "in_scope": len(inscope)}}
