"""IT cost baseline: totals, mix, growth, intensity ratios, reconciliation and roadmap affordability.
Inputs follow the client's cost template (overall IT costs, IT capex by initiative, IT opex by cost head) plus business
factors. Parameters: config `budget_rules`."""
from __future__ import annotations

from .common import xp


def _num(v) -> float | None:
    return float(v) if isinstance(v, (int, float)) else None


def _row(rows: list[dict], rid: str) -> list:
    return next((r["values"] for r in rows if r["id"] == rid), [])


def _sum(rows: list[dict], i: int) -> float | None:
    vals = [_num(r["values"][i]) for r in rows if i < len(r["values"])]
    vals = [v for v in vals if v is not None]
    return round(sum(vals), 2) if vals else None


def _pct(a, b) -> float | None:
    return round(100 * a / b, 1) if a is not None and b else None


def _growth(a, b) -> float | None:
    return round(100 * (b - a) / a, 1) if a and b is not None else None


def assess_budget(b: dict, cfg: dict, roadmap_fy: dict | None = None) -> dict:
    p = cfg["budget_rules"]
    fys = b["fys"]
    opex, sal, capex = (_row(b["overall"], k) for k in ("opex", "salaries", "capex"))
    fac = {f["id"]: f["values"] for f in b.get("factors", [])}
    per = []
    for i, fy in enumerate(fys):
        o, s, c = (_num(x[i]) if i < len(x) else None for x in (opex, sal, capex))
        total = round(sum(v for v in (o, s, c) if v is not None), 2) if any(v is not None for v in (o, s, c)) else None
        rev = _num(fac.get("revenue", [None] * len(fys))[i]) if fac.get("revenue") else None
        emp = _num(fac.get("employees", [None] * len(fys))[i]) if fac.get("employees") else None
        users = _num(fac.get("end_users", [None] * len(fys))[i]) if fac.get("end_users") else None
        oh, ch = _sum(b.get("opex", []), i), _sum(b.get("capex", []), i)
        cloud = _sum([r for r in b.get("opex", []) if r.get("kind") == "cloud"], i)
        per.append({
            "fy": fy, "actual": fy.endswith(b.get("actual_suffix", "A")), "opex": o, "salaries": s, "capex": c, "total": total,
            "run_share": _pct((o or 0) + (s or 0), total), "change_share": _pct(c, total), "salary_share": _pct(s, total),
            "pct_revenue": round(100 * total / rev, 2) if total and rev else None,
            "per_employee_lakh": round(total * 100 / emp, 2) if total and emp else None,
            "per_user_lakh": round(total * 100 / users, 2) if total and users else None,
            "opex_heads_total": oh, "capex_lines_total": ch,
            "opex_variance_pct": _growth(o, oh) if o and oh is not None else None,
            "capex_variance_pct": _growth(c, ch) if c and ch is not None else None,
            "cloud_share_opex": _pct(cloud, oh),
        })
    for i in range(1, len(per)):
        for k in ("opex", "salaries", "capex", "total"):
            per[i][f"{k}_yoy"] = _growth(per[i - 1][k], per[i][k])
    first, last = per[0], per[-1]
    n = len(per) - 1
    cagr = round(100 * ((last["total"] / first["total"]) ** (1 / n) - 1), 1) if n and first["total"] and last["total"] else None
    tol = p["variance_tolerance_pct"]
    recon = [f"{x['fy']} opex heads differ from overall opex by {x['opex_variance_pct']}%" for x in per
             if x["opex_variance_pct"] is not None and abs(x["opex_variance_pct"]) > tol] + \
            [f"{x['fy']} capex lines differ from overall capex by {x['capex_variance_pct']}%" for x in per
             if x["capex_variance_pct"] is not None and abs(x["capex_variance_pct"]) > tol]
    heads = []
    for r in b.get("opex", []):
        v = [_num(x) for x in r["values"]]
        heads.append({"id": r["id"], "name": r["name"], "kind": r.get("kind"), "latest": v[-1] if v else None,
                      "growth": _growth(v[0], v[-1]) if len(v) > 1 else None})
    lo, hi = p["benchmark_pct_revenue"]
    act = [x for x in per if x["actual"]]
    latest = act[-1] if act else first
    # affordability: roadmap investment per FY (low-high) against projected IT capex for the same FY
    afford = []
    for x in per:
        key = x["fy"][:-1] if x["fy"][-1].isalpha() else x["fy"]
        if roadmap_fy and key in roadmap_fy and x["capex"]:
            r_lo, r_hi = roadmap_fy[key]
            afford.append({"fy": x["fy"], "capex": x["capex"], "roadmap": [round(r_lo, 1), round(r_hi, 1)],
                           "share": [_pct(r_lo, x["capex"]), _pct(r_hi, x["capex"])]})
    expl = xp("IT cost baseline", [(x["fy"], f"opex {x['opex']} + salaries {x['salaries']} + capex {x['capex']} = {x['total']} Cr"
                                             + (f" · {x['pct_revenue']}% of revenue" if x["pct_revenue"] is not None else "")) for x in per],
              f"Latest actual {latest['fy']}: ₹{latest['total']} Cr, {latest['pct_revenue']}% of revenue; CAGR {cagr}% {first['fy']}–{last['fy']}",
              f"Total = opex + salaries + capex; intensity = total / revenue; benchmark band {lo}-{hi}% ({p['benchmark_note']})", f"§{p['togaf_ref']}")
    return {"per_fy": per, "cagr": cagr, "latest": latest, "recon": recon, "heads": sorted(heads, key=lambda h: -(h["latest"] or 0)),
            "benchmark": [lo, hi], "capex_target": p["capex_share_target"], "afford": afford, "explain": expl}
