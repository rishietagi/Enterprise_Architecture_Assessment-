"""Phase B current-state discovery: score each L3 questionnaire response and infer the L2 assessment
(process, technology & AI, data, integration, importance) plus business-IT alignment. Pure functions."""
from __future__ import annotations

import collections
import math
import statistics as st

from .common import band, fmt, xp

DIM_Q = (("P", "process", "Process standardisation"), ("T", "tech", "Technology & AI enablement"),
         ("D", "data", "Data availability & trust"), ("I", "integration", "Integration & hand-offs"))
ALIGN_Q = (("fit", "System fit"), ("partnering", "Business-IT partnering"), ("reporting", "Information & reporting"),
           ("change", "Responsiveness to change"), ("adoption", "User adoption"))
STATUSES = ("not_generated", "draft", "sent", "walkthrough", "redirected", "responded")
QUADRANTS = {  # business-IT alignment quadrant: (importance high?, IT support high?)
    (True, True): ("aligned", "Aligned: sustain"), (True, False): ("underserved", "Under-served: invest"),
    (False, True): ("overserved", "Over-served: rationalise"), (False, False): ("low", "Low priority: monitor")}


def round_half_up(x: float) -> int:
    return int(math.floor(x + 0.5))


def status_of(survey: dict | None) -> str:
    return survey["status"] if survey else "not_generated"


def _opt(questions: list[dict], qid: str, n) -> str:
    q = next((x for x in questions if x["id"] == qid), None)
    if not q or not q.get("options") or not isinstance(n, int) or not 1 <= n <= len(q["options"]):
        return str(n)
    return q["options"][n - 1]


def score_l3(l3: dict, survey: dict | None, cfg: dict) -> dict | None:
    """Scores for a submitted L3 response; None while pending or incomplete."""
    if not survey or survey.get("status") != "responded":
        return None
    a = survey.get("answers") or {}
    vals = [a.get(k) for _, k, _ in DIM_Q]
    if not all(isinstance(v, int) for v in vals):
        return None
    r = cfg["capability_rules"]
    imp_min, mat_max = r.get("gap_importance_min", 4), r.get("gap_maturity_max", 2.5)
    qs = survey.get("questions") or []
    m = st.mean(vals)
    imp = a.get("importance") if isinstance(a.get("importance"), int) else None
    fit, par = a.get("fit"), a.get("partnering")
    parts = [(lbl, a[k]) for k, lbl in ALIGN_Q if isinstance(a.get(k), int)]
    align = round(st.mean(v for _, v in parts), 2) if parts else None
    weakest = min(range(4), key=lambda i: (vals[i], i))
    is_gap = imp is not None and imp >= imp_min and m <= mat_max
    return {"q": vals, "maturity": round(m, 2), "band": band(m, r["heat_bands"]), "importance": imp, "fit": fit,
            "partnering": par, "alignment": align, "alignment_parts": [{"label": lbl, "value": v} for lbl, v in parts],
            "is_gap": is_gap, "weakest": DIM_Q[weakest][2],
            "explain": xp(f"{l3['id']} {l3['name']}",
                          [(lbl, f"{v} · {_opt(qs, k, v)}") for (_, k, lbl), v in zip(DIM_Q, vals)]
                          + [("Business criticality", f"{imp} · {_opt(qs, 'importance', imp)}"),
                             ("Business-IT alignment", f"mean({', '.join(f'{lbl.lower()} {v}' for lbl, v in parts)}) → "
                                                       f"{fmt(align) if align is not None else '–'}")],
                          f"L3 maturity = ({' + '.join(map(str, vals))}) / 4 = {m:.2f}",
                          f"Gap if importance ≥ {imp_min} and maturity ≤ {fmt(mat_max)} → {'GAP' if is_gap else 'no gap'}",
                          "§8.4, §32")}


def _auto_comment(label: str, inputs: list[tuple[dict, int]], value: int, mean: float, qs: list, qid: str) -> str:
    lo = min(inputs, key=lambda x: x[1])
    hi = max(inputs, key=lambda x: x[1])
    typical = collections.Counter(v for _, v in inputs).most_common(1)[0][0]
    txt = f"Mean {mean:.2f} → {value}. Typical answer: '{_opt(qs, qid, typical)}'."
    if lo[1] != hi[1]:
        txt += f" Weakest: {lo[0]['name']} ({lo[1]}); strongest: {hi[0]['name']} ({hi[1]})."
    return txt


def infer_l2(l2: dict, l3s: list[dict], surveys: dict, cfg: dict) -> dict:
    """Infer the L2 P/T/D/I/importance from submitted L3 responses (mean rounded half up; importance = highest L3)."""
    scored = [(x, surveys[x["id"]], score_l3(x, surveys.get(x["id"]), cfg)) for x in l3s if x["id"] in surveys]
    done = [(x, s, sc) for x, s, sc in scored if sc]
    pending = [x["id"] for x in l3s if not any(d[0]["id"] == x["id"] for d in done)]
    out = {"answered": len(done), "total": len(l3s), "pending": pending, "ready": bool(done)}
    if not done:
        return dict(out, q=None, importance=None, alignment=None, dims=[], explain=None)
    qs = done[0][1].get("questions") or []
    dims = []
    for i, (key, qid, label) in enumerate(DIM_Q):
        inputs = [(x, sc["q"][i]) for x, _, sc in done]
        mean = st.mean(v for _, v in inputs)
        value = round_half_up(mean)
        dims.append({"key": key, "label": label, "value": value, "mean": round(mean, 2),
                     "inputs": [{"id": x["id"], "name": x["name"], "value": v} for x, v in inputs],
                     "comment": _auto_comment(label, inputs, value, mean, qs, qid)})
    imps = [(x, sc["importance"]) for x, _, sc in done if sc["importance"] is not None]
    imp = max(v for _, v in imps) if imps else None
    top = [x["name"] for x, v in imps if v == imp]
    dims.append({"key": "IMP", "label": "Business criticality", "value": imp, "mean": round(st.mean(v for _, v in imps), 2) if imps else None,
                 "inputs": [{"id": x["id"], "name": x["name"], "value": v} for x, v in imps],
                 "comment": f"Highest L3 criticality = {imp}, from {', '.join(top[:2])}." if imps else "No importance answered."})
    aligns = [sc["alignment"] for _, _, sc in done if sc["alignment"] is not None]
    q = [d["value"] for d in dims[:4]]
    explain = xp(f"L2 inferred from discovery: {l2['id']} {l2['name']}",
                 [(d["label"], f"mean({', '.join(str(i['value']) for i in d['inputs'])}) = {fmt(d['mean'])} → {d['value']}")
                  for d in dims[:4]] + [("Business criticality", dims[4]["comment"]),
                                        ("Responses", f"{len(done)} of {len(l3s)} L3 answered"
                                         + (f"; pending {', '.join(pending)}" if pending else ""))],
                 f"Inferred P/T/D/I = {q}, business criticality {imp}",
                 "Each dimension = mean of the L3 answers rounded half up; business criticality = highest L3 answer", "§8.4, §32")
    return dict(out, q=q, importance=imp, alignment=round(st.mean(aligns), 2) if aligns else None, dims=dims, explain=explain)


def quadrant(importance: float | None, alignment: float | None, cfg: dict) -> dict | None:
    if importance is None or alignment is None:
        return None
    split = cfg["capability_rules"].get("quadrant_split", 2.5)  # equal quadrants on the 0-5 scales
    hi_imp = importance >= split
    hi_it = alignment >= split
    key, label = QUADRANTS[(hi_imp, hi_it)]
    return {"key": key, "label": label}


def rollup(nodes: list[dict]) -> dict:
    """Counts of survey statuses over a list of L3 nodes (each carries 'status')."""
    c = collections.Counter(n["status"] for n in nodes)
    total = len(nodes)
    return {"l3": total, **{k: c.get(k, 0) for k in STATUSES},
            "generated": total - c.get("not_generated", 0),
            "pct_responded": round(100 * c.get("responded", 0) / total) if total else 0}
