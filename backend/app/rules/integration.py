"""Phase C: Interface Catalog metrics for the interaction and integration views (§35.6.5). Metrics only, no gaps."""
from __future__ import annotations

import collections

from .common import xp

LEGACY = ("File / batch", "DB link", "Manual / re-key")


def assess_integration(interfaces: list, apps: list, external: list, cfg: dict) -> dict:
    hot = cfg.get("integration_rules", {}).get("hotspot_min", 5)
    name = {a["id"]: a["name"] for a in apps} | {x["id"]: x["name"] for x in external}
    n = len(interfaces)
    by_pattern = collections.Counter(i["pattern"] for i in interfaces)
    p2p = [i for i in interfaces if i.get("via", "Point-to-point") == "Point-to-point"]
    legacy = [i for i in interfaces if i["pattern"] in LEGACY]
    manual = [i for i in interfaces if i["pattern"] == "Manual / re-key"]
    degree = collections.Counter()
    for i in interfaces:
        degree[i["from"]] += 1
        degree[i["to"]] += 1
    hotspots = [{"id": a, "name": name.get(a, a), "degree": d} for a, d in degree.most_common() if d >= hot]
    pct = lambda k: round(100 * k / n) if n else 0  # noqa: E731
    return {
        "count": n, "by_pattern": dict(by_pattern), "p2p": len(p2p), "p2p_share": pct(len(p2p)),
        "legacy": len(legacy), "legacy_share": pct(len(legacy)), "manual": len(manual), "hotspots": hotspots,
        "degree": dict(degree), "hotspot_min": hot,
        "explain": {
            "p2p_share": xp("Point-to-point share", [(p, str(k)) for p, k in by_pattern.items()]
                            + [("Routed via API layer", str(n - len(p2p)))],
                            f"{len(p2p)} of {n} interfaces are point-to-point = {pct(len(p2p))}%",
                            "An interface is point-to-point unless routed through the governed API layer (P-CIL-03)",
                            "§35.6.5, §23.6.3 Principle 21"),
            "manual": xp("Manual hand-offs", [(i["id"], f"{name.get(i['from'], i['from'])} → {name.get(i['to'], i['to'])}: {i['data']}")
                                              for i in manual],
                         f"{len(manual)} interfaces re-key data by hand", "Pattern 'Manual / re-key'", "§35.6.5"),
            "hotspots": xp("Integration hotspots", [(h["id"], f"{h['name']}: {h['degree']} interfaces") for h in hotspots] or [("None", "-")],
                           f"{len(hotspots)} applications with ≥ {hot} interfaces",
                           "Degree = inbound + outbound interfaces in the Interface Catalog", "§35.6.5"),
        },
    }
