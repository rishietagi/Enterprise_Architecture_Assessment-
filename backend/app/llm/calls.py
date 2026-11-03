"""The 6 AI call types (PROJECT_CONTEXT §6). Each: retrieve TOGAF -> build grounded prompt -> generate_json with a
deterministic fallback that shows the retrieved excerpts unsynthesised."""
from __future__ import annotations

import re

from sqlmodel import Session, select

from .. import views
from ..rag.ingest import tokenize
from ..rag.profiles import profile
from ..rag.retrieve import INDEX, retrieve, to_hit
from . import prompts
from .gemini import generate_json


# --------------------------------------------------------------------------- helpers
def lead(text: str, limit: int = 230) -> str:
    """First sentence(s) of an excerpt, for the unsynthesised fallback."""
    t = re.sub(r"\s+", " ", text.replace("•", " ")).strip()
    t = re.sub(r"^(Statement|Rationale|Implications):\s*", "", t)
    sents = re.split(r"(?<=[.;:])\s+(?=[A-Z])", t)
    out = ""
    for snt in sents:
        if len(out) + len(snt) > limit and out:
            break
        out = f"{out} {snt}".strip()
    return out if len(out) <= limit + 40 else out[:limit].rsplit(" ", 1)[0] + " …"


def numbered(hits: list[dict]) -> list[dict]:
    return [dict(h, n=n) for n, h in enumerate(hits, start=1)]


def clean_cites(items: list[dict], k: int) -> list[dict]:
    out = []
    for it in items:
        cites = sorted({int(c) for c in it.get("cites", []) if 1 <= int(c) <= k})
        out.append({**it, "cites": cites})
    return out


def section_hits(prefixes: tuple[str, ...], limit: int = 3) -> list[dict]:
    found = [c for c in INDEX.chunks if c["source"] == "course" and (c.get("section_no") or "").startswith(prefixes)]
    return [to_hit(c) for c in found[:limit]]


def merge_hits(*groups: list[dict], k: int = 6) -> list[dict]:
    seen, out = set(), []
    for g in groups:
        for h in g:
            if h["id"] not in seen:
                seen.add(h["id"])
                out.append(h)
    return out[:k]


def result(res: dict, payload: dict, hits: list[dict]) -> dict:
    return {**payload, "citations": numbered(hits), "mode": res["mode"], "model": res.get("model"),
            "reason": res.get("reason")}


# --------------------------------------------------------------------------- 1. coach(screen)
NEXT_ACTIONS = {
    "overview": ["Confirm the ADM tailoring and phase owners with the CIO", "Validate scores in discovery workshops"],
    "approach": ["Confirm the scope of work and phase gates with the CIO at kick-off", "Name a CIL counterpart for every phase"],
    "vision": ["Agree 10-20 principles with the ARB and record rationale", "Generate and review the Architecture Vision with sponsors"],
    "business": ["Run the capability questionnaire with business owners", "Validate the top capability gaps against 2030 strategy"],
    "applications": ["Send the intake template to app owners for the 50-60 external apps", "Confirm survivors for each duplication cluster"],
    "data_tech": ["Name a business data owner for every domain", "Classify PII domains under DPDP Act 2023"],
    "roadmap": ["Review wave sequencing and dependencies with the ARB", "Validate the Rs rate card with finance"],
    "budget": ["Load finance actuals for the last two years", "Tag every capex line to a roadmap initiative"],
}


def coach(s: Session, screen: str) -> dict:
    facts = views.summary(s, screen)
    hits = retrieve(profile(screen)["query"], screen=screen, k=6)
    k = len(hits)

    def fallback():
        return {"guidance": [{"text": lead(h["text"]), "cites": [n]} for n, h in enumerate(hits[:5], start=1)],
                "next_actions": NEXT_ACTIONS.get(screen, NEXT_ACTIONS["overview"])}
    prompt = prompts.build(prompts.TASKS["coach"].format(screen=screen), facts, hits)
    res = generate_json("coach", prompt, prompts.SCHEMAS["coach"], fallback)
    d = res["data"]
    guidance = [g for g in clean_cites(d.get("guidance", []), k) if g["cites"]] or fallback()["guidance"]
    return result(res, {"screen": screen, "guidance": guidance, "next_actions": d.get("next_actions", [])[:2]}, hits)


# --------------------------------------------------------------------------- 2. ask(q, screen)
def ask(s: Session, q: str, screen: str | None) -> dict:
    hits = retrieve(q, screen=screen, k=6)
    if len(hits) < 3:
        hits = merge_hits(hits, retrieve(q, k=6))
    k = len(hits)

    def fallback():
        if not hits:
            return {"answer": "Not covered by TOGAF excerpts (index not built).", "cites": []}
        return {"answer": " ".join(f"{lead(h['text'], 180)} [{n}]" for n, h in enumerate(hits[:3], start=1)),
                "cites": list(range(1, min(3, k) + 1))}
    facts = {"screen": screen, "question": q}
    prompt = prompts.build(prompts.TASKS["ask"].format(q=q), facts, hits)
    res = generate_json("ask", prompt, prompts.SCHEMAS["ask"], fallback)
    d = res["data"]
    cites = sorted({int(c) for c in d.get("cites", []) if 1 <= int(c) <= k})
    return result(res, {"question": q, "answer": d.get("answer", ""), "cites": cites}, hits)


# --------------------------------------------------------------------------- 3. draft_vision()
def draft_vision(s: Session) -> dict:
    v = views.vision(s)
    facts = {"request": v["engagement"]["request"], "horizon": v["engagement"]["horizon"],
             "drivers": [d["driver"] for d in v["drivers"]],
             "focus_areas": [f"{f['name']}: {f['detail']}" for f in v["focus_areas"]],
             "scope_in": v["scope"]["in_scope"], "scope_out": v["scope"]["out_of_scope"],
             "constraints": v["scope"]["constraints"],
             "adopted_principles": [p["name"] for p in v["principles"]["togaf"] + v["principles"]["cil"] if p["adopted"]],
             "ai_initiatives": [f"{i['name']} ({i['status']})" for i in v["ai_initiatives"]]}
    hits = merge_hits(section_hits(("36.2.8",), 2), section_hits(("7.4",), 2),
                      retrieve("Architecture Vision statement business goals drivers objectives", screen="vision",
                               phases=["A"], types=["deliverable", "steps", "approach"], k=4), k=6)
    focus = [f["name"] for f in v["focus_areas"]]

    def fallback():
        return {
            "vision_statement": ("A connected, data-driven Coromandel where every farmer, dealer, plant and acquired entity "
                                 "runs on one governed architecture that scales digital agronomy and AI to 2030."),
            "ai_ambition": ("Move AI from pilots to governed, grounded production use across R&D, agronomy advisory, retail "
                            "and plants, on a shared Azure AI platform with human-in-the-loop for farmer-facing advice."),
            "objectives": [f"Enable {f.lower()} on shared architecture building blocks" for f in focus[:4]]
                          + ["Establish EA governance with an ARB and a maintained repository"],
            "success_measures": ["Share of applications with a confirmed disposition (target TBD)",
                                 "Data domains with a named owner and score >= 60 (target TBD)",
                                 "AI initiatives that are data-ready (target TBD)",
                                 "Architecture decisions reviewed by the ARB per quarter (target TBD)"],
            "cites": [n for n in range(1, min(3, len(hits)) + 1)]}
    prompt = prompts.build(prompts.TASKS["draft_vision"], facts, hits)
    res = generate_json("draft_vision", prompt, prompts.SCHEMAS["draft_vision"], fallback)
    d = res["data"]
    cites = sorted({int(c) for c in d.get("cites", []) if 1 <= int(c) <= len(hits)})
    return result(res, {"vision_statement": d.get("vision_statement", ""), "ai_ambition": d.get("ai_ambition", ""),
                        "objectives": d.get("objectives", [])[:5], "success_measures": d.get("success_measures", [])[:5],
                        "cites": cites}, hits)


VISION_THEMES = [  # deterministic fallback: one statement per architecture theme, tied to drivers and focus areas
    {"key": "core", "title": "One connected value chain", "drivers": ["D1", "D3"], "terms": ["erp", "sap", "supply", "plant", "integration", "planning"],
     "statement": "Plants, supply chain, sales and finance run on one clean-core platform with governed integration, so a demand "
                  "signal flows from the farmer to the plant and back without re-keying."},
    {"key": "farmer", "title": "Farmer and channel at the centre", "drivers": ["D6"], "focus": "F3", "terms": ["farmer", "retail", "dealer", "store", "advisory", "app"],
     "statement": "Every farmer, dealer and Gromor store interaction runs through one digital agronomy and commerce platform, "
                  "with one record of the farmer shared across advisory, orders and service."},
    {"key": "data", "title": "Data owned, trusted and reusable", "drivers": ["D3"], "focus": "F5", "terms": ["data", "quality", "analytics", "report", "privacy"],
     "statement": "Each data domain has a named business owner, agreed definitions and measured quality, so decisions and AI "
                  "models use one trusted version of the numbers and personal data is protected by design."},
    {"key": "ai", "title": "AI in production, governed", "drivers": ["D5"], "focus": "F1", "terms": ["ai", "machine", "model", "drone", "digital", "automation"],
     "statement": "AI moves from pilots to governed production use across R&D, agronomy, drones and operations, on a shared "
                  "platform with human review for farmer-facing advice and measured business value."},
    {"key": "scale", "title": "A foundation that scales", "drivers": ["D2", "D4"], "terms": ["acquisition", "growth", "cloud", "security", "standard", "scale"],
     "statement": "A standards-led, cloud-smart and secure foundation lets CIL absorb acquisitions, launch new businesses and "
                  "retire duplicate systems quickly, with every architecture decision governed by the ARB."},
]


def _vision_context(s: Session) -> tuple[dict, str, list[dict]]:
    from ..context_docs import themes
    from ..models import ContextDoc, SettingOverride
    ov = s.get(SettingOverride, "vision_context")
    vc = dict(ov.value) if ov else {}
    docs = list(s.exec(select(ContextDoc)))
    corpus = "\n\n".join([vc.get("text", "")] + [d.text for d in docs])
    return vc, corpus, themes(corpus) if corpus.strip() else []


def vision_statements(s: Session) -> dict:
    """Five Architecture Vision statements from the context box, uploaded documents, drivers and focus areas."""
    from ..context_docs import sentences_with
    v = views.vision(s)
    vc, corpus, th = _vision_context(s)
    facts = {"context_notes": vc.get("text", "")[:4000], "documents": [d["name"] for d in v["context"]["docs"]],
             "document_excerpts": corpus[:9000], "context_themes": [t["term"] for t in th],
             "drivers": [f"{d['id']}: {d['driver']}" for d in v["drivers"]],
             "focus_areas": [f"{f['id']} {f['name']}: {f['detail']}" for f in v["focus_areas"]],
             "scope_in": v["scope"]["in_scope"], "constraints": v["scope"]["constraints"]}
    hits = merge_hits(section_hits(("36.2.8",), 2), section_hits(("7.4",), 2),
                      retrieve("Architecture Vision statement business goals drivers", screen="vision", phases=["A"],
                           types=["deliverable", "steps", "approach"], k=4), k=6)
    terms = [t["term"] for t in th]
    low = corpus.lower()

    def fallback():
        out = []
        for t in VISION_THEMES:
            hit = [w for w in t["terms"] if w in low]
            out.append({"title": t["title"], "statement": t["statement"], "drivers": t["drivers"],
                        "evidence": sentences_with(corpus, hit, 2) if hit else [], "cites": [1] if hits else []})
        return {"statements": out}
    prompt = prompts.build(prompts.TASKS["vision_statements"], facts, hits)
    res = generate_json("draft_vision", prompt, prompts.SCHEMAS["vision_statements"], fallback)
    sts = []
    for x in res["data"].get("statements", [])[:5]:
        sts.append({"title": x.get("title", "").strip(), "statement": x.get("statement", "").strip(),
                    "drivers": [d for d in x.get("drivers", []) if any(d == y["id"] for y in v["drivers"])],
                    "evidence": x.get("evidence", [])[:2],
                    "cites": sorted({int(c) for c in x.get("cites", []) if 1 <= int(c) <= len(hits)})})
    if len(sts) < 5:
        sts += fallback()["statements"][len(sts):]
    return result(res, {"statements": sts, "themes": th}, hits)


PRINCIPLE_TEMPLATES = [  # fallback: a principle for a theme the adopted set does not yet cover
    {"terms": ["drone", "robot", "telemetry", "iot"], "category": "Technology", "name": "Connected devices by design",
     "statement": "Drones, sensors and field devices connect through one governed IoT and telemetry platform; no device stores data outside it.",
     "rationale": "The drone and robotics ecosystem (F4) scales only if telemetry, prescription maps and operations share one platform.",
     "implications": ["Device onboarding follows a security baseline", "Telemetry lands in the governed data platform", "Point solutions need an ARB waiver"],
     "togaf_basis": "Interoperability; Common Use Applications (§23.6)"},
    {"terms": ["supplier", "procurement", "vendor", "partner"], "category": "Business", "name": "Partner ecosystem on open interfaces",
     "statement": "Suppliers, distributors and partners connect through published APIs and standard formats, not bespoke files.",
     "rationale": "Partner growth and acquisitions multiply point-to-point links unless interfaces are standardised.",
     "implications": ["Partner onboarding uses the API catalogue", "File exchanges are time-boxed with an exit plan", "Interface owners are named"],
     "togaf_basis": "Interoperability (§23.6)"},
    {"terms": ["sustainab", "carbon", "esg", "water", "soil"], "category": "Business", "name": "Sustainability measured in the architecture",
     "statement": "Sustainability data (energy, water, emissions, soil health) is captured once, at source, and reported from the governed platform.",
     "rationale": "ESG reporting and soil-health advisory need trusted data, not year-end collection exercises.",
     "implications": ["Plant and field systems capture ESG data at source", "One owner per sustainability metric", "ESG reports come from the data platform"],
     "togaf_basis": "Data is an Asset (§23.6)"},
    {"terms": ["user", "experience", "mobile", "adoption"], "category": "Application", "name": "Mobile-first for the field",
     "statement": "Field sales, agronomists and retail staff get mobile-first, offline-capable applications that work in low connectivity.",
     "rationale": "Most farmer and dealer interactions happen in the field, where connectivity is intermittent.",
     "implications": ["New field apps are offline-capable", "One mobile design system", "Usage is measured as an adoption KPI"],
     "togaf_basis": "Ease-of-Use (§23.6)"},
    {"terms": [""], "category": "Data", "name": "Measure before you automate",
     "statement": "Every process is measured (volume, cycle time, error rate) before it is automated or AI-enabled, and after go-live.",
     "rationale": "Discovery shows many processes run without KPIs; without a baseline, automation value cannot be proven.",
     "implications": ["Each initiative records a process baseline", "Benefits are tracked after go-live", "KPI owners sit in the business"],
     "togaf_basis": "Maximise Benefit to the Enterprise (§23.6)"},
]


def suggest_principle(s: Session, hint: str = "") -> dict:
    """One editable architecture principle in the TOGAF §23.4 template, from the context and the gaps in the set."""
    v = views.vision(s)
    vc, corpus, th = _vision_context(s)
    have = [p["name"] for p in v["principles"]["cil"] + v["principles"]["togaf"] if p["adopted"]]
    facts = {"hint": hint, "context_themes": [t["term"] for t in th], "context_notes": vc.get("text", "")[:3000],
             "document_excerpts": corpus[:6000], "drivers": [d["driver"] for d in v["drivers"]],
             "focus_areas": [f"{f['name']}: {f['detail']}" for f in v["focus_areas"]], "already_adopted": have}
    hits = merge_hits(section_hits(("23.4",), 2), section_hits(("23.6",), 2),
                      retrieve("architecture principles name statement rationale implications " + hint, screen="vision", k=3), k=5)
    low = (corpus + " " + hint).lower()

    def fallback():
        names = {n.lower() for n in have}
        avail = [t for t in PRINCIPLE_TEMPLATES if t["name"].lower() not in names] or PRINCIPLE_TEMPLATES[-1:]
        pick = next((t for t in avail if any(w and w in low for w in t["terms"])), avail[0])
        return {k: pick[k] for k in ("name", "statement", "rationale", "implications", "category", "togaf_basis")} | {"cites": [1] if hits else []}
    prompt = prompts.build(prompts.TASKS["suggest_principle"], facts, hits)
    res = generate_json("draft_vision", prompt, prompts.SCHEMAS["suggest_principle"], fallback)
    d = res["data"]
    out = {k: d.get(k, "") for k in ("name", "statement", "rationale", "category", "togaf_basis")}
    out["implications"] = [x for x in d.get("implications", []) if isinstance(x, str)][:4]
    out["cites"] = sorted({int(c) for c in d.get("cites", []) if 1 <= int(c) <= len(hits)})
    return result(res, out, hits)


# --------------------------------------------------------------------------- 4. map_apps(apps)
def _stem(w: str) -> str:
    return w[:5]


def keyword_map(apps: list[dict], l2: list[dict]) -> list[dict]:
    l2_tok = {c["id"]: {_stem(w) for w in tokenize(c["name"] + " " + c["l1"])} for c in l2}
    out = []
    for a in apps:
        toks = {_stem(w) for w in tokenize(f"{a.get('name', '')} {a.get('description', '')} {a.get('issues', '')}")}
        scored = sorted(((len(toks & t) / max(1, len(t)), cid) for cid, t in l2_tok.items() if toks & t), reverse=True)
        caps = [cid for sc, cid in scored[:2] if sc > 0]
        out.append({"app_id": a["id"], "caps": caps, "confidence": round(scored[0][0], 2) if scored else 0.0})
    return out


def map_apps(s: Session, app_ids: list[str] | None = None) -> dict:
    a = views.applications(s)
    targets = [x for x in a["apps"] if (app_ids and x["id"] in app_ids) or (not app_ids and not x["caps"])][:30]
    l2 = a["l2"]
    valid = {c["id"] for c in l2}
    hits = merge_hits(section_hits(("35.6.5",), 3), retrieve("Application/Function Matrix application portfolio "
                                                             "catalog mapping", screen="applications", k=3), k=5)
    if not targets:
        return {"mappings": [], "citations": numbered(hits), "mode": "none", "model": None, "reason": "No unmapped applications"}
    facts = {"applications": [{"id": x["id"], "name": x["name"], "description": x.get("description", ""),
                               "type": x.get("type")} for x in targets],
             "capability_l2": [f"{c['id']} {c['name']} ({c['l1']})" for c in l2]}
    prompt = prompts.build(prompts.TASKS["map_apps"], facts, hits)
    res = generate_json("map_apps", prompt, prompts.SCHEMAS["map_apps"], lambda: {"mappings": keyword_map(targets, l2)})
    names = {x["id"]: x["name"] for x in targets}
    l2n = {c["id"]: c["name"] for c in l2}
    maps = []
    for m in res["data"].get("mappings", []):
        if m.get("app_id") in names:
            caps = [c for c in m.get("caps", []) if c in valid][:3]
            maps.append({"app_id": m["app_id"], "app_name": names[m["app_id"]], "caps": caps,
                         "cap_names": [l2n[c] for c in caps], "confidence": float(m.get("confidence", 0))})
    return result(res, {"mappings": maps, "method": "ai" if res["mode"] != "fallback" else "keyword"}, hits)


# --------------------------------------------------------------------------- 5. findings(screen)
def rule_findings(s: Session, screen: str) -> list[dict]:
    """Deterministic findings stated straight from rule outputs (used without a key)."""
    f = views.summary(s, screen)
    if screen == "business":
        k = f["kpis"]
        return [{"text": f"{k['weak_critical']} of {k['n_caps']} L2 capabilities sit in the weak or critical band; average maturity {k['avg_maturity']}/5.", "rule": "mean(process, technology & AI, data, integration)"},
                {"text": f"{k['gaps']} capability gaps (importance ≥ 4, maturity ≤ 2.5); {k['high_priority_gaps']} carry priority ≥ 20.", "rule": "§27 gap rule"},
                {"text": "Weakest L1 areas: " + ", ".join(f"{n} ({m})" for n, m in f["weakest_l1"]) + ".", "rule": "L1 mean of L2 maturity"}]
    if screen == "applications":
        k = f["kpis"]
        split = ", ".join(f"{n} {v}" for n, v in f["dispositions"].items())
        return [{"text": f"Disposition split across {k['inventoried']} apps: {split}.", "rule": "BF/TF quadrant + rationalization rules"},
                {"text": f"{k['clusters']} duplication clusters where ≥ 2 in-scope apps serve the same L2 capability; "
                         f"{f['integration']['p2p_share']}% of {f['integration']['count']} interfaces are point-to-point.", "rule": "duplication rule; Interface Catalog"},
                {"text": f"{k['lifecycle_unknown']} applications have unknown lifecycle status and need validation.", "rule": "lifecycle == Unknown"}]
    if screen == "data_tech":
        k = f["kpis"]
        return [{"text": f"Average data-domain score {k['data_avg']}/100; {k['privacy_risk']} domains hold unclassified personal data (DPDP Act 2023).", "rule": "weighted data score"},
                {"text": "Domains without a named owner: " + ", ".join(f["domains_without_owner"]) + ".", "rule": "owner == false"},
                {"text": f"Resilience score {k['resilience_score']}/100 with {k['to_validate']} items to validate in discovery.", "rule": "§48.5 checklist"}]
    if screen == "roadmap":
        k = f["kpis"]
        return [{"text": f"{k['gaps']} gaps roll up into {k['initiatives']} initiatives costing Rs {k['total_cr'][0]:.1f}-{k['total_cr'][1]:.1f} Cr.", "rule": "rate card x size"},
                {"text": "ACMM elements at level ≤ 1: " + ", ".join(f["acmm_low"]) + ".", "rule": "§51.3 ACMM"},
                {"text": "Sequencing: " + "; ".join(f["initiatives"][:3]) + ".", "rule": "wave rules + dependencies"}]
    if screen == "budget":
        p = f["per_fy"]
        return [{"text": f"{p[-1]['fy']} IT spend ₹{p[-1]['total']} Cr ({p[-1]['pct_revenue']}% of revenue).", "rule": "opex + salaries + capex"},
                {"text": "Largest opex heads: " + ", ".join(f["largest_heads"][:3]) + ".", "rule": "opex by cost head"},
                {"text": ("Reconcile: " + "; ".join(f["reconciliation"][:2]) + ".") if f["reconciliation"] else "Detail and totals reconcile.", "rule": "detail vs overall"}]
    if screen == "approach":
        return [{"text": f"Week {f['current_week']} of {f['weeks']}; {f['progress']}% of planned activities are done.", "rule": "plan status"},
                {"text": "Phases: " + "; ".join(f"{p['name']} {p['weeks']} ({p['progress']}%)" for p in f["phases"]) + ".", "rule": "phase roll-up"},
                {"text": "Each phase closes at a gate: " + "; ".join(p["gate"] for p in f["phases"][:3]) + ".", "rule": "approach"}]
    if screen == "vision":
        return [{"text": f"{len(f['drivers'])} business drivers and {len(f['focus_areas'])} digital focus areas frame the vision.", "rule": "deck"},
                {"text": f"{f['principles_adopted']} principles adopted" + (f" ({f['principles_warning']})." if f["principles_warning"] else ", inside the 10-20 range."), "rule": "§23.6 limit"},
                {"text": f"{len(f['ai_initiatives_not_ready'])} AI initiatives are blocked by data domains scoring < 60.", "rule": "data readiness"}]
    k = f["kpis"]
    return [{"text": f"ACMM mean {k['acmm_mean']}/5 and average capability maturity {k['avg_cap_maturity']}/5.", "rule": "§51.3 / Phase B"},
            {"text": f"Average data-domain score {k['data_avg']}/100.", "rule": "data score"},
            {"text": f"Roadmap Rs {k['total_cr'][0]:.1f}-{k['total_cr'][1]:.1f} Cr across 4 waves.", "rule": "rate card"}]


TAB_QUERY = {  # extra retrieval terms for per-tab insights
    "reference": "business capability map reference model", "discovery": "business scenarios interviews stakeholders baseline",
    "process": "baseline business architecture capability assessment", "matrix": "gap analysis prioritisation capability",
    "alignment": "business IT alignment application function matrix", "entanglement": "dependencies interoperability capability",
    "gaps": "gap analysis candidate roadmap components", "models": "process flow diagram business process modelling",
    "intake": "application portfolio catalog inventory", "rationalization": "application portfolio rationalization gap analysis",
    "capability": "application business function matrix capability", "architecture": "application architecture baseline",
    "interaction": "application communication diagram interfaces", "integration": "interface catalog interoperability integration",
    "health": "technology currency resilience single point of failure scalability", "inputs": "data entity catalog technology portfolio",
    "data": "data governance data quality", "tech": "technology standards compliance checklist", "engineering": "technology standards lifecycle automation",
    "data_arch": "data architecture data dissemination", "infra": "technology architecture platform decomposition network",
    "longlist": "work packages consolidated gaps solutions", "priority": "prioritization business value risk migration planning",
    "roadmap": "transition architecture architecture roadmap migration plan", "governance": "architecture board compliance governance repository",
    "analysis": "implementation and migration plan cost benefit business value", "budget": "migration planning cost value",
}


def findings(s: Session, screen: str, tab: str | None = None) -> dict:
    """AI insights. With a tab, the facts and the rule-based fallback are that tab's insights (3-4 items)."""
    facts = views.summary(s, screen)
    base = rule_findings(s, screen)
    n = 3
    if tab:
        ins = views.tab_insights(s, screen, tab)
        if ins:
            base, n = ins, min(4, len(ins))
            facts = dict(facts, tab=tab, tab_insights=[i["text"] for i in ins])
    hits = retrieve(profile(screen)["query"] + " " + TAB_QUERY.get(tab or "", "gap analysis recommendations"), screen=screen, k=6)
    k = len(hits)

    def fallback():
        return {"findings": [{"text": f["text"], "cites": []} for f in base[:n]],
                "recommendations": [{"text": lead(h["text"]), "cites": [i]} for i, h in enumerate(hits[:3], start=1)]}
    label = f"{screen} > {tab}" if tab else screen
    prompt = prompts.build(prompts.TASKS["findings"].format(screen=label, n=n), facts, hits)
    res = generate_json("findings", prompt, prompts.SCHEMAS["findings"], fallback)
    d = res["data"]
    fs = clean_cites(d.get("findings", []), k)[:n]
    if res["mode"] == "fallback":
        fs = [dict(x, rule=b["rule"]) for x, b in zip(fs, base)]
    return result(res, {"screen": screen, "tab": tab, "findings": fs,
                        "recommendations": clean_cites(d.get("recommendations", []), k)[:3]}, hits)


# --------------------------------------------------------------------------- 6. initiative_briefs()
def initiative_briefs(s: Session) -> dict:
    rm = views.roadmap(s)
    gap_title = {g["id"]: g["title"] for g in rm["gaps"]}
    inits = [{"theme_id": i["id"], "name": i["name"], "wave": i["wave_id"], "size": i["size"],
              "cost_cr": i["cost_cr"], "depends_on": i["depends_on"],
              "gaps": [gap_title[g] for g in i["gap_ids"][:8]]} for i in rm["initiatives"]]
    hits = merge_hits(section_hits(("28.1", "28.2"), 2), section_hits(("36.2.7",), 1),
                      retrieve("migration planning work packages transition architecture implementation and migration plan",
                               screen="roadmap", k=4), k=6)

    def fallback():
        return {"briefs": [{"theme_id": i["theme_id"],
                            "summary": f"{i['name']} closes {len(i['gaps'])} prioritised gaps in {i['wave']}"
                                       + (f", after {', '.join(i['depends_on'])}." if i["depends_on"] else "."),
                            "outcomes": i["gaps"][:3] + ["Gap closed and validated"] * max(0, 3 - len(i["gaps"][:3])),
                            "cites": [1] if hits else []} for i in inits]}
    prompt = prompts.build(prompts.TASKS["initiative_briefs"], {"initiatives": inits}, hits)
    res = generate_json("initiative_briefs", prompt, prompts.SCHEMAS["initiative_briefs"], fallback)
    briefs = {}
    for b in res["data"].get("briefs", []):
        if b.get("theme_id") in {i["theme_id"] for i in inits}:
            briefs[b["theme_id"]] = {"summary": b.get("summary", ""), "outcomes": b.get("outcomes", [])[:3],
                                     "cites": sorted({int(c) for c in b.get("cites", []) if 1 <= int(c) <= len(hits)})}
    if res["mode"] == "fallback":
        for bid in briefs:
            briefs[bid]["outcomes"] = [f"Resolve: {o}" if not o.startswith("Gap closed") else o for o in briefs[bid]["outcomes"]]
    return result(res, {"briefs": briefs}, hits)
