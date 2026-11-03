"""SQLite engine, first-start seeding and state loading (DB rows -> seed-shaped dicts for the rules)."""
from __future__ import annotations

import copy
import json
import re
from collections.abc import Iterator
from functools import lru_cache
from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine, delete, select

from .config import get_settings
from .models import (AcmmLevel, Application, ArchView, Capability, ContextDoc, DataDomain, Decision, Guideline, Integration, PlanTask,
                     Platform, PrincipleSelection, ProcessModel, SettingOverride, Survey, TechCheck, VisionDoc)

# Demo defaults (assumed): CIL principles plus the TOGAF principles they build on.
SEED_ADOPTED_TOGAF = ["TOGAF-01", "TOGAF-02", "TOGAF-10", "TOGAF-15", "TOGAF-21"]
GUIDE_KINDS = (("principle", "principles_cil"), ("guardrail", "guardrails"), ("pattern", "patterns"),
               ("viewpoint", "viewpoints"), ("tailoring", "tailoring"))
SEED_DECISIONS = [

    {"title": "Adopt TOGAF 9.1 ADM as the EA method",
     "context": "Proposal asks for an industry-aligned EA baseline, target state and governance model.",
     "decision": "Run Preliminary to Phase H with a lightweight repository; ARB chaired by the CIO reviews all solution designs.",
     "principles": ["TOGAF-01", "TOGAF-02"], "status": "Proposed"},
    {"title": "API-first for farmer-facing integrations",
     "context": "MyGromor, Nutri Connect, WhatsApp bot and partner platforms overlap on advisory (C07.1).",
     "decision": "New integrations go through the governed API layer; no new point-to-point links to retail or ERP.",
     "principles": ["P-CIL-03", "TOGAF-21"], "status": "Proposed"},
]
TABLES = (Capability, Application, DataDomain, Platform, TechCheck, AcmmLevel, PrincipleSelection, VisionDoc, Decision,
          SettingOverride, Guideline, Integration, Survey, ProcessModel, PlanTask, ContextDoc, ArchView)
SEED_VERSION = 6  # bump when the seed shape changes so existing demo databases are rebuilt once

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        path: Path = get_settings().db_path
        path.parent.mkdir(parents=True, exist_ok=True)
        _engine = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})
    return _engine


def get_session() -> Iterator[Session]:
    with Session(get_engine()) as s:
        yield s


@lru_cache
def read_seed() -> dict:
    d = get_settings().seed_dir

    def j(name):
        return json.loads((d / name).read_text(encoding="utf-8"))
    integ = j("integrations.json")
    return {"vision": j("vision.json"), "caps": j("capabilities.json"), "apps": j("applications.json")["applications"],
            "data": j("data_domains.json")["domains"], "tech": j("technology.json"), "cfg": j("config.json"),
            "reference": j("reference_model.json")["nodes"], "integrations": integ["interfaces"],
            "external": integ["external"], "integration_meta": integ["_meta"], "discovery": j("discovery.json"),
            "process_models": j("process_models.json")["models"], "ref_views": j("reference_views.json")["views"],
            "budget": j("budget.json")}


def nat_key(s: str) -> list:
    """Natural sort: C05.2 < C05.10."""
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", s)]


def init_db() -> None:
    SQLModel.metadata.create_all(get_engine())
    with Session(get_engine()) as s:
        ver = s.get(SettingOverride, "seed_version")
        if s.exec(select(Capability).where(Capability.level == 3)).first() is None or (ver.value if ver else {}).get("v") != SEED_VERSION:
            reset_demo(s)  # first start, or a database seeded from an older shape


def seed_all(s: Session) -> None:
    seed = read_seed()
    for l0 in seed["caps"].get("l0", []):
        s.add(Capability(id=l0["id"], level=0, data={**l0, "level": 0, "parent": None}))
    for l1 in seed["caps"]["capabilities"]:
        s.add(Capability(id=l1["id"], level=1, data={k: v for k, v in l1.items() if k != "children"} | {"level": 1, "parent": l1.get("l0")}))
        for c in l1["children"]:
            s.add(Capability(id=c["id"], level=2, data={**{k: copy.deepcopy(v) for k, v in c.items() if k != "l3"},
                                                        "level": 2, "parent": l1["id"]}))
            for x in c.get("l3", []):
                s.add(Capability(id=x["id"], level=3, data={**x, "level": 3, "parent": c["id"]}))
    seed_discovery(s, seed)
    for a in seed["apps"]:
        s.add(Application(id=a["id"], data=copy.deepcopy(a), source=a.get("source", "assumed")))
    for d in seed["data"]:
        s.add(DataDomain(id=d["id"], data=copy.deepcopy(d), source=d.get("source", "assumed")))
    for p in seed["tech"]["platforms"]:
        s.add(Platform(id=p["id"], data=copy.deepcopy(p), source=p.get("source", "assumed")))
    for c in seed["tech"]["resilience_checks"] + seed["tech"].get("engineering_checks", []):
        s.add(TechCheck(id=c["id"], status=c["status"], source=c.get("source", "assumed")))
    for e in seed["cfg"]["governance"]["acmm_elements"]:
        s.add(AcmmLevel(id=e["id"], level=e["seed"], source="assumed"))
    for kind, key in GUIDE_KINDS:
        for g in seed["vision"].get(key, []):
            s.add(Guideline(id=g["id"], kind=kind, data={**copy.deepcopy(g), "active": True}, source=g.get("source", "assumed")))
    for i in seed["integrations"]:
        s.add(Integration(id=i["id"], data=copy.deepcopy(i), source=i.get("source", "assumed")))
    for p in seed["vision"]["principles_cil"]:
        s.add(PrincipleSelection(id=p["id"], adopted=True))
    for pid in SEED_ADOPTED_TOGAF:
        s.add(PrincipleSelection(id=pid, adopted=True))
    s.add(VisionDoc(id=1))
    for d in SEED_DECISIONS:
        s.add(Decision(**d))
    s.add(SettingOverride(key="seed_version", value={"v": SEED_VERSION}))
    s.commit()


def seed_discovery(s: Session, seed: dict) -> None:
    """Demo surveys (questions materialised from the template), analysed L2s, process models and plan status."""
    from .discovery import generate_questions
    l3 = {x["id"]: x for l1 in seed["caps"]["capabilities"] for c in l1["children"] for x in c.get("l3", [])}
    for sv in seed["discovery"]["surveys"]:
        s.add(Survey(id=sv["id"], data={**copy.deepcopy(sv), "questions": generate_questions(l3[sv["id"]]),
                                        "finalised": sv["status"] != "draft"},
                     source=sv.get("source", "assumed")))
    s.flush()
    for a in seed["discovery"]["analyses"]:
        row = s.get(Capability, a["id"])
        row.data = {**row.data, "discovery": {k: v for k, v in a.items() if k != "id"}}
        s.add(row)
    for m in seed["process_models"]:
        s.add(ProcessModel(id=m["id"], data=copy.deepcopy(m), source=m.get("source", "assumed")))
    for rv in seed["ref_views"]:
        s.add(ArchView(id=rv["id"], screen=rv["screen"], data=copy.deepcopy(rv), source=rv.get("source", "assumed")))
    for ph in seed["vision"].get("engagement_plan", {}).get("phases", []):
        for t in ph["activities"]:
            s.add(PlanTask(id=t["id"], status=t["status"], source="assumed"))


def reset_demo(s: Session) -> None:
    for model in TABLES:
        s.exec(delete(model))
    s.commit()
    seed_all(s)


def deep_merge(base: dict, patch: dict) -> dict:
    out = copy.deepcopy(base)
    for k, v in patch.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = copy.deepcopy(v)
    return out


def effective_config(s: Session) -> dict:
    cfg = read_seed()["cfg"]
    ov = s.get(SettingOverride, "config")
    return deep_merge(cfg, ov.value) if ov else copy.deepcopy(cfg)


def load_caps(s: Session) -> dict:
    """Catalog rows -> {questionnaire, l0, capabilities: [L1 + children], value_streams} (rules_reference shape)."""
    seed = read_seed()["caps"]
    rows = sorted(s.exec(select(Capability)), key=lambda r: nat_key(r.id))
    l0 = [dict(r.data, id=r.id, source=r.source) for r in rows if r.level == 0]
    l1s = []
    for r in (x for x in rows if x.level == 1):
        kids = [dict(c.data, id=c.id, source=c.score_source, catalog_source=c.source,
                     l3=[dict(x.data, id=x.id, source=x.source) for x in rows if x.level == 3 and x.data.get("parent") == c.id])
                for c in rows if c.level == 2 and c.data.get("parent") == r.id]
        l1s.append(dict(r.data, id=r.id, source=r.source, children=kids))
    return {"questionnaire": copy.deepcopy(seed["questionnaire"]), "l0": l0, "capabilities": l1s}


def load_state(s: Session) -> dict:
    """Current inputs in the exact shape rules_reference.load_seed() returns, plus acmm levels and provenance."""
    seed = read_seed()
    apps = [dict(a.data, source=a.source) for a in sorted(s.exec(select(Application)), key=lambda a: nat_key(a.id))]
    data = [dict(d.data, source=d.source) for d in s.exec(select(DataDomain).order_by(DataDomain.id))]
    tech = copy.deepcopy(seed["tech"])
    status = {c.id: c for c in s.exec(select(TechCheck))}
    for c in tech["resilience_checks"] + tech.get("engineering_checks", []):
        if c["id"] in status:
            c["status"], c["source"] = status[c["id"]].status, status[c["id"]].source
    sites = s.get(SettingOverride, "sites")
    if sites:
        tech["locations"], tech["network"] = sites.value.get("locations", tech["locations"]), sites.value.get("network", tech.get("network", []))
        tech["sites_source"] = "client"
    lz = s.get(SettingOverride, "landing_zones")
    if lz:
        tech["landing_zones"] = lz.value.get("items", tech.get("landing_zones", []))
    tech["platforms"] = [dict(p.data, source=p.source) for p in s.exec(select(Platform).order_by(Platform.id))]
    acmm = {a.id: a.level for a in s.exec(select(AcmmLevel))}
    acmm_src = {a.id: a.source for a in s.exec(select(AcmmLevel))}
    vision = copy.deepcopy(seed["vision"])
    guides = sorted(s.exec(select(Guideline)), key=lambda g: nat_key(g.id))
    for kind, key in GUIDE_KINDS:
        vision[key] = [dict(g.data, id=g.id, source=g.source) for g in guides if g.kind == kind]
    sow = s.get(SettingOverride, "scope_of_work")
    if sow:
        vision["scope_of_work"] = {**vision.get("scope_of_work", {}), **sow.value, "source": "client"}
    bud = s.get(SettingOverride, "budget")
    budget = copy.deepcopy(bud.value) if bud else copy.deepcopy(seed["budget"])
    integrations = [dict(i.data, id=i.id, source=i.source) for i in sorted(s.exec(select(Integration)), key=lambda i: nat_key(i.id))]
    return {"vision": vision, "caps": load_caps(s), "apps": apps, "data": data, "tech": tech,
            "cfg": effective_config(s), "acmm": acmm, "acmm_source": acmm_src, "reference": seed["reference"],
            "integrations": integrations, "external": seed["external"],
            "surveys": {v.id: dict(v.data, source=v.source) for v in s.exec(select(Survey))},
            "process_models": [dict(m.data, id=m.id, source=m.source) for m in sorted(s.exec(select(ProcessModel)), key=lambda m: m.id)],
            "plan_status": {t.id: (t.status, t.source) for t in s.exec(select(PlanTask))},
            "ref_views": {v.id: dict(v.data, id=v.id, source=v.source) for v in s.exec(select(ArchView))},
            "budget": budget}
