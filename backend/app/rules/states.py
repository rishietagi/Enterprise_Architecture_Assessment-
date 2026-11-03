"""Phase E/F: current, transition (per wave) and target architecture states, projected from the gap register.
A gap closes when its initiative's wave completes; closing it moves the measure to its rule-defined target."""
from __future__ import annotations

import statistics as st

from .common import fmt, xp
from .rationalization import ACTION_URGENCY

CLOUD = {"Azure", "SaaS", "Partner-hosted", "RISE (SAP-managed)"}
SCORE = {"pass": 100, "partial": 50, "fail": 0}


def architecture_states(r: dict, seed: dict) -> dict:
    cfg = seed["cfg"]
    waves = cfg["roadmap"]["waves"]
    gap_wave = {gid: i["wave"] for i in r["initiatives"] for gid in i["gap_ids"]}
    init_wave = {i["id"]: i["wave"] for i in r["initiatives"]}
    integ_theme = next((t["id"] for t in cfg["themes"] if "R05" in t.get("tech", [])), None)
    dmin = cfg["data_rules"].get("gap_score_below", 60)
    disp = {a["id"]: a["disposition"] for a in r["app_rows"]}
    in_scope = {a["id"] for a in seed["apps"] if a["in_scope"]}
    interfaces = seed.get("integrations", [])

    def snap(k: int) -> dict:  # k = -1 current, 0..3 after wave k, 4 target
        done = set(gap_wave) if k >= 4 else {g for g, w in gap_wave.items() if w <= k}
        closed = lambda kind, ref: k >= 4 or f"{kind}:{ref}" in done  # noqa: E731
        caps = [max(c["maturity"], c["target"]) if closed("capability", c["id"]) or k >= 4 else c["maturity"]
                for c in r["cap_rows"]]
        below = sum(m < c["target"] for m, c in zip(caps, r["cap_rows"]))
        action = [a for a in r["app_rows"] if a["disposition"] in ACTION_URGENCY and not closed("application", a["id"])]
        clusters = [cl for cl in r["clusters"] if not closed("duplication", cl["cap"])]
        hosts = []
        for a in seed["apps"]:
            if not a["in_scope"] or a["hosting"] == "Unknown":
                continue
            moved = a["hosting"] == "DC-HYD" and disp[a["id"]] in ACTION_URGENCY and closed("application", a["id"])
            hosts.append("Azure" if moved else a["hosting"])
        data = [max(d["score"], dmin) if closed("data", d["id"]) else d["score"] for d in r["data_rows"]]
        stat = ["pass" if closed("technology", c["id"]) else c["status"] for c in seed["tech"]["resilience_checks"]]
        known = [SCORE[s] for s in stat if s in SCORE]
        api_done = k >= 4 or (integ_theme in init_wave and init_wave[integ_theme] <= k)
        p2p = [i for i in interfaces if i.get("via", "Point-to-point") == "Point-to-point"
               and not (api_done and i["from"] in in_scope and i["to"] in in_scope)]
        return {"cap": round(st.mean(caps), 2) if caps else 0, "below": below,
                "gaps": len(gap_wave) - len(done), "apps": len(action), "clusters": len(clusters),
                "cloud": round(100 * sum(h in CLOUD or h == "Azure" for h in hosts) / max(1, len(hosts))),
                "data": round(st.mean(data)) if data else 0, "resilience": round(st.mean(known)) if known else None,
                "p2p": round(100 * len(p2p) / max(1, len(interfaces)))}

    cols = [{"id": "current", "name": "Current state", "window": "Baseline"}]
    cols += [{"id": w["id"], "name": f"Transition {w['id']}", "window": w["window"], "wave": i} for i, w in enumerate(waves)]
    cols.append({"id": "target", "name": "Target state", "window": "2030"})
    snaps = [snap(-1)] + [snap(i) for i in range(len(waves))] + [snap(4)]
    defs = [
        ("cap", "Avg capability maturity", "/ 5", "higher", "business",
         "Capability gap closes at its initiative's wave → maturity lifted to its target (by importance). Target state: every L2 at target."),
        ("below", "L2 below target maturity", "", "lower", "business", "Count of assessed L2 whose maturity is under the importance-based target."),
        ("gaps", "Open gaps", "", "lower", "roadmap", "Gaps still open after the wave; every gap belongs to one initiative."),
        ("apps", "Apps needing action", "", "lower", "applications", "Apps dispositioned Modernise, Replace or Consolidate whose gap is not yet closed."),
        ("clusters", "Duplication clusters open", "", "lower", "applications", "A cluster closes when its consolidation gap closes."),
        ("cloud", "Cloud-hosted share", "%", "higher", "data_tech",
         "In-scope apps with known hosting on Azure, SaaS, partner or RISE. Apps on DC-HYD move to Azure when their app gap closes (P-CIL-01)."),
        ("data", "Avg data-domain score", "/ 100", "higher", "data_tech", f"Data gap closes → domain lifted to the gap threshold {dmin}."),
        ("resilience", "Resilience score", "/ 100", "higher", "data_tech", "Technology gap closes → check passes. Unknown checks stay excluded until validated."),
        ("p2p", "Point-to-point interfaces", "%", "lower", "applications",
         "When the integration & API initiative completes, interfaces between in-scope apps route through the API layer (P-CIL-03)."),
    ]
    metrics = []
    for key, lbl, unit, better, screen, rule in defs:
        vals = [s[key] for s in snaps]
        metrics.append({"key": key, "label": lbl, "unit": unit, "better": better, "screen": screen, "values": vals,
                        "explain": xp(lbl, [(c["name"], f"{fmt(v) if v is not None else '–'}{(' ' + unit) if unit else ''}")
                                            for c, v in zip(cols, vals)],
                                      f"{fmt(vals[0]) if vals[0] is not None else '–'} today → {fmt(vals[-1]) if vals[-1] is not None else '–'} in the target state",
                                      rule, "§28, §36.2.14")})
    return {"columns": cols, "metrics": metrics}
