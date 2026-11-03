"""Phase C (Data): domain governance score and gaps (port of rules_reference.assess_data)."""
from __future__ import annotations

import statistics as st

from .common import band, band_range, fmt, gap, xp


def assess_data(domains: list, cfg: dict):
    r = cfg["data_rules"]
    w, mv = r["score_weights"], r["mdm_values"]
    below = r.get("gap_score_below", 60)
    rows, gaps = [], []
    for d in domains:
        q = st.mean(d["quality"]) / 5
        parts = [
            ("Named owner", w["owner"] * d["owner"], f"{w['owner']} × {fmt(d['owner'])}"),
            ("System of record", w["sor"] * bool(d["sor"]), f"{w['sor']} × {d['sor'] or 'none'}"),
            ("MDM", w["mdm"] * mv[d["mdm"]], f"{w['mdm']} × {d['mdm']} ({fmt(mv[d['mdm']])})"),
            ("Quality", w["quality"] * q, f"{w['quality']} × mean({', '.join(map(str, d['quality']))}) / 5 = {w['quality']} × {q:.2f}"),
            ("Lineage", w["lineage"] * d["lineage"], f"{w['lineage']} × {fmt(d['lineage'])}"),
            ("Classified (if PII)", w["classified_if_pii"] * ((not d["pii"]) or d["classified"]),
             f"{w['classified_if_pii']} × " + ("no PII → granted" if not d["pii"] else fmt(d["classified"]))),
        ]
        raw = sum(p[1] for p in parts)
        s = round(raw)
        privacy_risk = d["pii"] and not d["classified"]
        is_gap = s < below or not d["owner"] or privacy_risk
        reasons = [x for x, ok in ((f"score {s} < {below}", s < below), ("no named owner", not d["owner"]),
                                   ("PII not classified (DPDP Act 2023)", privacy_risk)) if ok]
        explain = xp(f"{d['id']} {d['name']}", [(n, f"{how} = {v:.1f}") for n, v, how in parts],
                     f"Score = {raw:.1f} → {s} → {band_range(s, r['bands'])}",
                     ("GAP: " + "; ".join(reasons)) if is_gap else f"No gap: score ≥ {below}, owner named, PII handled",
                     "§23.6.2, §34.6, §35.6.4")
        rows.append({"id": d["id"], "name": d["name"], "score": s, "band": band(s, r["bands"]),
                     "privacy_risk": privacy_risk, "is_gap": is_gap, "explain": explain})
        if is_gap:
            imp = 5 if privacy_risk else (4 if len(d["consumers"]) >= 3 else 3)
            gaps.append(gap("data", d["id"], f"Data domain not governed: {d['name']}", imp, 5 if privacy_risk else 3, "C_DATA", "10.4",
                            impact_why="unclassified PII → 5" if privacy_risk else f"{len(d['consumers'])} consuming apps → {imp}",
                            urgency_why="unclassified PII (DPDP Act 2023) → 5" if privacy_risk else "default → 3",
                            trigger="; ".join(reasons)))
    return rows, gaps


def data_readiness(initiatives: list, data_rows: list, cfg: dict) -> list:
    """AI initiative is data-ready only if every dependent domain scores >= ai_ready_min."""
    th = cfg["data_rules"].get("ai_ready_min", 60)
    score = {d["id"]: d for d in data_rows}
    out = []
    for i in initiatives:
        deps = i.get("depends_on_data_domains", [])
        blocking = [{"id": d, "name": score[d]["name"], "score": score[d]["score"]}
                    for d in deps if d in score and score[d]["score"] < th]
        explain = xp(f"{i['id']} data readiness",
                     [(f"{d} {score[d]['name']}", f"{score[d]['score']} {'≥' if score[d]['score'] >= th else '<'} {th}")
                      for d in deps if d in score],
                     "Ready" if not blocking else f"Blocked by {', '.join(b['id'] for b in blocking)}",
                     f"Ready only if every dependent data domain scores ≥ {th}", "§23.6.2")
        out.append({**i, "ready": not blocking, "blocking": blocking, "explain": explain})
    return out
