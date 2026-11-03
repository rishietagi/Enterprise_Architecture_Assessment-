"""Phase B: capability maturity, gaps, targets, entanglement and reference coverage
(port of rules_reference.assess_capabilities, extended). L2 without a questionnaire answer (q is None) is 'not assessed'
and excluded from maturity and gaps."""
from __future__ import annotations

import collections
import itertools
import statistics as st

from .common import band, band_range, fmt, gap, xp

DIMS = ("Process standardisation", "Technology & AI enablement", "Data availability & trust", "Integration & hand-offs")


def target_for(importance: int, cfg: dict) -> float:
    return float(cfg["capability_rules"].get("target_maturity", {}).get(str(importance), 3.0))


def _ladder(caps: dict, q: list) -> str:
    """Label of the Technology & AI enablement answer (Manual ... Agentic AI)."""
    for qq in caps.get("questionnaire", {}).get("questions", []):
        if qq["key"] == "digital" and qq.get("options"):
            return qq["options"][q[1] - 1]["label"]
    return str(q[1])


def assess_capabilities(caps: dict, cfg: dict):
    r = cfg["capability_rules"]
    imp_min, mat_max = r.get("gap_importance_min", 4), r.get("gap_maturity_max", 2.5)
    crit_max = r.get("critical_maturity_max", 1.5)
    u_focus, u_default = r.get("urgency_focus", 5), r.get("urgency_default", 3)
    rows, gaps = [], []
    for l1 in caps["capabilities"]:
        for c in l1["children"]:
            if not c.get("q"):
                continue
            m = st.mean(c["q"])
            is_gap = c["importance"] >= imp_min and m <= mat_max
            gap_rule = (f"Importance {c['importance']} {'≥' if c['importance'] >= imp_min else '<'} {imp_min} and maturity "
                        f"{m:.2f} {'≤' if m <= mat_max else '>'} {fmt(mat_max)} → {'GAP' if is_gap else 'no gap'}")
            tgt = target_for(c["importance"], cfg)
            explain = xp(f"{c['id']} {c['name']}",
                         [(d, str(v)) for d, v in zip(DIMS, c["q"])] + [("Importance to 2030", str(c["importance"])),
                                                                         ("Target maturity", f"{fmt(tgt)} for importance {c['importance']}")],
                         f"Maturity = ({' + '.join(map(str, c['q']))}) / 4 = {m:.2f} → {band_range(m, r['heat_bands'])}",
                         gap_rule, "§8.4, §27, §32")
            rows.append({"id": c["id"], "l1_id": l1["id"], "l1": l1["name"], "name": c["name"], "q": list(c["q"]),
                         "maturity": round(m, 2), "importance": c["importance"],
                         "gap_score": round(c["importance"] - m, 2), "band": band(m, r["heat_bands"]),
                         "focus": c.get("focus"), "is_gap": is_gap, "source": c.get("source", "assumed"),
                         "target": tgt, "to_target": round(max(0.0, tgt - m), 2), "ai_level": _ladder(caps, c["q"]),
                         "explain": explain})
            if is_gap:
                u = u_focus if c.get("focus") else u_default
                why = f"focus area {c['focus']} → {u_focus}" if c.get("focus") else f"not a focus area → {u_default}"
                if m <= crit_max:
                    u = min(5, u + 1)
                    why += f"; maturity ≤ {fmt(crit_max)} → +1 (max 5) = {u}"
                gaps.append(gap("capability", c["id"], f"Low maturity: {c['name']}", c["importance"], u, "B", "27",
                                impact_why="= importance score", urgency_why=why, trigger=gap_rule))
    return rows, gaps


def entanglement(caps: dict, apps: list, cfg: dict) -> dict:
    """Explicit dependencies (depends_on) plus implicit coupling through shared applications."""
    l2 = {c["id"]: dict(c, l1=l1["id"]) for l1 in caps["capabilities"] for c in l1["children"]}
    deps = [(c, d) for c in l2 for d in l2[c].get("depends_on", []) if d in l2 and d != c]  # c consumes d
    shared = collections.defaultdict(set)
    for a in apps:
        for x, y in itertools.combinations(sorted({c for c in a["caps"] if c in l2}), 2):
            shared[(x, y)].add(a["id"])
    hi = cfg["capability_rules"].get("entanglement_high", 6)
    nodes = []
    for cid, c in l2.items():
        up = sorted(d for x, d in deps if x == cid)
        down = sorted(x for x, d in deps if d == cid)
        sh = sorted({y for x, y in shared if x == cid} | {x for x, y in shared if y == cid})
        score = len(up) + len(down) + len(sh)
        nodes.append({"id": cid, "name": c["name"], "l1": c["l1"], "upstream": up, "downstream": down, "shared": sh,
                      "score": score, "high": score >= hi,
                      "explain": xp(f"Entanglement: {cid} {c['name']}",
                                    [("Depends on (upstream)", ", ".join(up) or "none"),
                                     ("Feeds (downstream)", ", ".join(down) or "none"),
                                     ("Shares an application with", ", ".join(sh) or "none")],
                                    f"Score = {len(up)} + {len(down)} + {len(sh)} = {score}" + (" → highly entangled" if score >= hi else ""),
                                    f"Upstream + downstream dependencies + capabilities coupled through a shared app; "
                                    f"≥ {hi} is highly entangled", "§27, §35.6.3")})
    l1_links = collections.Counter((l2[d]["l1"], l2[c]["l1"]) for c, d in deps if l2[d]["l1"] != l2[c]["l1"])
    return {"nodes": nodes, "dependencies": [{"from": d, "to": c} for c, d in deps],
            "shared": [{"a": x, "b": y, "apps": sorted(v)} for (x, y), v in sorted(shared.items())],
            "l1_links": [{"from": a, "to": b, "count": n} for (a, b), n in sorted(l1_links.items())],
            "high": sum(n["high"] for n in nodes), "threshold": hi}


def coverage(caps: dict, reference: list) -> dict:
    """How much of the leading-practice reference model the CIL catalog covers, per reference L1."""
    adopted = {c.get("ref") for l1 in caps["capabilities"] for c in l1["children"] if c.get("ref")}
    l1s = [n for n in reference if n["level"] == 1]
    rows = []
    for l1 in l1s:
        kids = [n for n in reference if n["parent"] == l1["id"]]
        got = [k["id"] for k in kids if k["id"] in adopted]
        rows.append({"id": l1["id"], "name": l1["name"], "total": len(kids), "adopted": len(got), "adopted_ids": got})
    total = sum(r["total"] for r in rows)
    n = sum(r["adopted"] for r in rows)
    custom = [c["id"] for l1 in caps["capabilities"] for c in l1["children"] if not c.get("ref")]
    return {"by_l1": rows, "adopted": n, "total": total, "custom": custom,
            "explain": xp("Reference-model coverage", [(r["name"], f"{r['adopted']} of {r['total']} L2") for r in rows]
                          + [("CIL-specific (no reference)", ", ".join(custom) or "none")],
                          f"{n} of {total} leading-practice L2 adopted = {round(100 * n / max(1, total))}%",
                          "A reference L2 counts as adopted when a CIL L2 links to it", "§8.4, §32")}
