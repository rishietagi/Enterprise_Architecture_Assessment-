from __future__ import annotations

SIZES = ["S", "M", "L", "XL"]


def band(value: float, bands: list) -> str:
    for lo, hi, name in bands:
        if lo <= value < hi:
            return name
    return bands[-1][2]


def band_range(value: float, bands: list) -> str:
    for lo, hi, name in bands:
        if lo <= value < hi:
            return f"{name} [{fmt(lo)}, {fmt(hi)})"
    return bands[-1][2]


def fmt(x) -> str:
    if isinstance(x, bool):
        return "yes" if x else "no"
    if isinstance(x, float) and not x.is_integer():
        return f"{x:.2f}".rstrip("0").rstrip(".")
    return str(int(x)) if isinstance(x, (int, float)) else str(x)


def xp(title: str, lines: list[tuple[str, str]], result: str, rule: str | None = None, ref: str | None = None) -> dict:
    """Explanation trace shown behind the (i) icon: the inputs, the formula result, the rule that fired, the TOGAF ref."""
    return {"title": title, "lines": [{"label": a, "value": b} for a, b in lines], "result": result, "rule": rule,
            "ref": ref}


def gap(kind, ref, title, impact, urgency, phase, togaf_ref, impact_why: str = "", urgency_why: str = "",
        trigger: str = ""):
    return {"id": f"{kind}:{ref}", "kind": kind, "ref": ref, "title": title, "impact": impact, "urgency": urgency,
            "priority": impact * urgency, "adm_phase": phase, "togaf_ref": togaf_ref,
            "explain": xp(f"Gap priority: {ref}",
                          [("Why it is a gap", trigger or title), ("Impact", f"{impact} · {impact_why}" if impact_why else str(impact)),
                           ("Urgency", f"{urgency} · {urgency_why}" if urgency_why else str(urgency))],
                          f"Priority = impact × urgency = {impact} × {urgency} = {impact * urgency}",
                          ref=f"§{togaf_ref}")}
