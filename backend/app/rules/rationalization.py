"""Phase C (Application): fit-quadrant rationalization, principle-driven rules and duplication clusters
(port of rules_reference.rationalize, extended with configurable rules, weights, labels and overrides).

Dispositions are internal codes (Invest / Tolerate / Migrate / Eliminate / Consolidate / Retain (out of scope)); the
consulting terminology shown to users comes from config rationalization.labels (e.g. Eliminate -> Replace)."""
from __future__ import annotations

import collections
import statistics as st

from .common import fmt, gap, xp

TIME = {(True, True): "Invest", (True, False): "Migrate", (False, True): "Tolerate", (False, False): "Eliminate"}
OUT = "Retain (out of scope)"
ACTION_URGENCY = {"Migrate": 4, "Eliminate": 3, "Consolidate": 3}
BF_DIMS = ("Functional fit", "Strategic alignment", "User satisfaction")
TF_DIMS = ("Technology currency", "Integration / API readiness", "Security & compliance", "Cost efficiency")
DEFAULT_RULES = [{"id": "RR-01", "when": "out_of_scope", "then": OUT, "enabled": True},
                 {"id": "RR-02", "when": "eol_24m", "then": "Migrate", "enabled": True}]


def label(code: str, cfg: dict) -> str:
    return cfg["rationalization"].get("labels", {}).get(code, {}).get("label", code)


def _wmean(xs: list, ws: list | None) -> float:
    if not ws or len(set(ws)) == 1:
        return st.mean(xs)
    return sum(x * w for x, w in zip(xs, ws)) / sum(ws)


def _wtext(xs: list, ws: list | None, mean: float) -> str:
    if not ws or len(set(ws)) == 1:
        return f"({' + '.join(map(str, xs))}) / {len(xs)} = {mean:.2f}"
    return f"({' + '.join(f'{fmt(w)}×{x}' for x, w in zip(xs, ws))}) / {fmt(sum(ws))} = {mean:.2f}"


def _clusters(apps: list, bf_of: dict) -> list:
    by_cap = collections.defaultdict(list)
    for a in apps:
        if a["in_scope"]:
            for c in a["caps"]:
                by_cap[c].append(a)
    clusters = []
    for cap, members in sorted(by_cap.items()):
        if len(members) >= 2:
            ranked = sorted(members, key=lambda a: (bool(a["sor"]), bf_of[a["id"]]), reverse=True)
            survivor = ranked[0]
            clusters.append({"cap": cap, "apps": [a["id"] for a in members], "survivor": survivor["id"],
                             "explain": xp(f"Duplication on {cap}",
                                           [(f"{a['id']} {a['name']}", f"SoR: {', '.join(a['sor']) or 'none'} · BF {bf_of[a['id']]:.2f}")
                                            for a in ranked],
                                           f"Survivor: {survivor['id']} {survivor['name']}",
                                           f"{len(members)} in-scope apps serve {cap} (≥ 2 → cluster). Survivor = system of "
                                           "record first, then highest business fit.", "§27, §35.6.5")})
    return clusters


def _fires(rule: dict, a: dict, d: str, ctx: dict) -> str | None:
    """Short reason if the rule fires on app a whose current disposition is d, else None."""
    w, p = rule["when"], rule.get("params", {})
    if w == "out_of_scope":
        return "out of scope" if not a["in_scope"] else None
    if w == "eol_24m" and a["lifecycle"] == "EOL < 24m" and d in ("Invest", "Tolerate"):
        return "EOL < 24m"
    if (w == "security_floor" and d in ("Invest", "Tolerate") and a["tf"][2] <= p.get("max_security", 2)
            and a["criticality"] >= p.get("min_criticality", 4)):
        return f"security {a['tf'][2]} on criticality {a['criticality']}"
    if w == "duplicate" and a["id"] in ctx["survivor_of"] and d != "Eliminate":
        return f"duplicate of {ctx['survivor_of'][a['id']]}"
    if w == "clean_core" and a.get("type") == "Custom" and a.get("layer", "Enterprise Apps") in p.get("layers", ["Enterprise Apps", "Core business"]):
        shared = sorted(set(a["caps"]) & ctx["core_caps"].get(p.get("core_vendor", "SAP"), set()))
        if shared:
            return f"custom overlap with {p.get('core_vendor', 'SAP')} on {', '.join(shared)}"
    if w == "strategic_protect" and d == "Eliminate" and a["bf"][1] >= p.get("min_alignment", 4):
        return f"strategic alignment {a['bf'][1]}"
    return None


def _explain(a, bf, tf, th, quad, d, fired, cfg, wb, wt) -> dict:
    L = lambda c: label(c, cfg)  # noqa: E731
    lines = [(f"BF · {n}", str(v)) for n, v in zip(BF_DIMS, a["bf"])]
    lines.append(("Business fit (mean)" if not wb or len(set(wb)) == 1 else "Business fit (weighted)", _wtext(a["bf"], wb, bf)))
    lines += [(f"TF · {n}", str(v)) for n, v in zip(TF_DIMS, a["tf"])]
    lines.append(("Technical fit (mean)" if not wt or len(set(wt)) == 1 else "Technical fit (weighted)", _wtext(a["tf"], wt, tf)))
    lines.append(("Lifecycle", a["lifecycle"]))
    if a["in_scope"]:
        lines.append(("Fit quadrant", f"{'high' if bf >= th else 'low'} BF + {'high' if tf >= th else 'low'} TF → {L(quad)}"))
    for rule, why in fired:
        lines.append((f"Rule {rule['id']}", f"{rule.get('name', rule['when'])}: {why} → {L(rule['then'])}"))
    ov = a.get("override")
    if ov and ov.get("disposition"):
        lines.append(("Override", f"{L(ov['disposition'])} · {ov.get('reason') or 'no reason given'}"))
    if not a["in_scope"]:
        rule = f"Rule RR-01: in_scope = false (SAP RISE / OT) → {L(OUT)}, dependencies only"
    else:
        rule = (f"Quadrant at threshold {th:.1f}: high BF + high TF = {L('Invest')}, high BF + low TF = {L('Migrate')}, "
                f"low BF + high TF = {L('Tolerate')}, low BF + low TF = {L('Eliminate')}; then enabled rules in order")
    if a["lifecycle"] == "Unknown":
        rule += ". Lifecycle unknown → flagged 'Validate lifecycle'"
    return xp(f"{a['id']} {a['name']}", lines, _rationale(a, bf, tf, th, d, fired, cfg), rule, "§11.4, §27, §28.2, §35.6.5")


def _rationale(a, bf, tf, th, d, fired, cfg) -> str:
    """Deterministic one-liner, e.g. 'BF 3.33 ≥ 3.0, TF 2.75 < 3.0 → Modernise'."""
    L = lambda c: label(c, cfg)  # noqa: E731
    ov = a.get("override") if (a.get("override") or {}).get("disposition") else None
    final = ov["disposition"] if ov else d
    if not a["in_scope"] and fired and fired[0][0]["when"] == "out_of_scope":
        text = f"Out of scope (dependencies only) → {L(d)}"
    else:
        base = f"BF {bf:.2f} {'≥' if bf >= th else '<'} {th:.1f}, TF {tf:.2f} {'≥' if tf >= th else '<'} {th:.1f}"
        reasons = [why for r, why in fired if r["when"] != "out_of_scope"]
        text = f"{base}, {', '.join(reasons)} → {L(d)}" if reasons else f"{base} → {L(d)}"
    if ov and final != d:
        text += f"; overridden to {L(final)}" + (f": {ov['reason']}" if ov.get("reason") else "")
    return text


QUAD_TEXT = {  # (business fit high?, technical fit high?) -> plain-language reading of the fit quadrant
    (True, True): "it serves the business well and the technology is sound",
    (True, False): "the business depends on it but the technology is holding it back",
    (False, True): "the technology is sound but it adds little business value",
    (False, False): "it neither fits the business nor stands up technically",
}
ACTION_TEXT = {"Invest": "Keep investing and extend its use.", "Tolerate": "Run it as is, with minimal spend, until a review.",
               "Migrate": "Modernise the platform while keeping the functionality.",
               "Eliminate": "Plan its replacement and retire it.", "Consolidate": "Fold it into the surviving application.",
               OUT: "Outside this assessment; capture dependencies only."}
RULE_TEXT = {"eol_24m": "it reaches end of life within 24 months", "security_floor": "its security score is too low for a critical system",
             "duplicate": "another application already covers the same capability", "clean_core": "it duplicates functionality in the core ERP",
             "strategic_protect": "it is strategically important"}


def _statement(a, bf, tf, th, d, fired, cfg) -> str:
    """Consultant-style rationale for the disposition, in words (the numbers stay in the rule trace)."""
    L = lambda c: label(c, cfg)  # noqa: E731
    ov = a.get("override") if (a.get("override") or {}).get("disposition") else None
    final = ov["disposition"] if ov else d
    if not a["in_scope"]:
        text = f"{a['name'].split(' (')[0]} is out of scope for this assessment, so it is retained and assessed for dependencies only."
    else:
        weak_bf = BF_DIMS[min(range(3), key=lambda i: a["bf"][i])].lower()
        weak_tf = TF_DIMS[min(range(4), key=lambda i: a["tf"][i])].lower()
        text = f"{L(d)}: {QUAD_TEXT[(bf >= th, tf >= th)]}"
        if bf < th:
            text += f", with {weak_bf} the weakest business factor"
        if tf < th:
            text += f"; {weak_tf} is the main technical concern"
        why = [RULE_TEXT[r["when"]] for r, _ in fired if r["when"] in RULE_TEXT]
        if why:
            text += ", and " + " and ".join(why)
        text += f". {ACTION_TEXT.get(d, '')}"
        if a["lifecycle"] == "Unknown":
            text += " Lifecycle status needs to be confirmed."
    if ov and final != d:
        text += f" Overridden by the architect to {L(final)}" + (f": {ov['reason']}." if ov.get("reason") else ".")
    return text.strip()


def rationalize(apps: list, cfg: dict):
    rc = cfg["rationalization"]
    th = rc["threshold"]
    wb, wt = rc.get("bf_weights"), rc.get("tf_weights")
    rules = [r for r in (rc.get("rules") or DEFAULT_RULES) if r.get("enabled", True)]
    fit = {a["id"]: (_wmean(a["bf"], wb), _wmean(a["tf"], wt)) for a in apps}
    clusters = _clusters(apps, {k: round(v[0], 2) for k, v in fit.items()})
    survivor_of = {m: cl["survivor"] for cl in clusters for m in cl["apps"] if m != cl["survivor"]}
    core_caps = collections.defaultdict(set)
    for a in apps:
        core_caps[a.get("vendor", "")].update(a["caps"])
    ctx = {"survivor_of": survivor_of, "core_caps": core_caps}

    rows = []
    for a in apps:
        bf, tf = fit[a["id"]]
        quad = TIME[(bf >= th, tf >= th)]
        d, fired = quad, []
        for rule in rules:
            if rule["when"] != "out_of_scope" and not a["in_scope"]:
                continue
            why = _fires(rule, a, d, ctx)
            if why:
                d = rule["then"]
                fired.append((rule, why))
                if rule["when"] == "out_of_scope":
                    break
        if not a["in_scope"] and not fired:
            d = quad
        ov = a.get("override") or {}
        final = ov.get("disposition") or d
        rows.append({"id": a["id"], "name": a["name"], "business_fit": round(bf, 2), "technical_fit": round(tf, 2),
                     "disposition": final, "label": label(final, cfg), "quadrant": quad, "rule_disposition": d,
                     "overridden": final != d, "rules_fired": [r["id"] for r, _ in fired],
                     "consolidate_into": survivor_of.get(a["id"]),
                     "validate_lifecycle": a["lifecycle"] == "Unknown", "criticality": a["criticality"],
                     "rationale": _rationale(a, bf, tf, th, d, fired, cfg),
                     "statement": _statement(a, bf, tf, th, d, fired, cfg),
                     "explain": _explain(a, bf, tf, th, quad, d, fired, cfg, wb, wt)})

    gaps = []
    crit = {a["id"]: a["criticality"] for a in apps}
    for r in rows:
        if r["disposition"] in ACTION_URGENCY:
            u = ACTION_URGENCY[r["disposition"]]
            gaps.append(gap("application", r["id"], f"{r['label']}: {r['name']}", crit[r["id"]], u, "C_APP", "28.2",
                            impact_why="= business criticality", urgency_why=f"{r['label']} → {u}",
                            trigger=r["rationale"]))
    for cl in clusters:
        gaps.append(gap("duplication", cl["cap"], f"{len(cl['apps'])} apps serve {cl['cap']}", 4, 3, "C_APP", "27",
                        impact_why="fixed for duplication", urgency_why="fixed for duplication",
                        trigger=f"{', '.join(cl['apps'])} all serve {cl['cap']}; proposed survivor {cl['survivor']}"))
    return rows, clusters, gaps
