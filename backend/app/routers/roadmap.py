from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session

from .. import views
from ..db import deep_merge, effective_config, get_session

from ..llm import calls
from ..models import AcmmLevel, Decision, SettingOverride

router = APIRouter(prefix="/api/roadmap", tags=["roadmap"])


class AcmmIn(BaseModel):
    level: int = Field(ge=0, le=5)


class DecisionIn(BaseModel):
    title: str = Field(min_length=1)
    context: str = ""
    decision: str = ""
    principles: list[str] = []
    status: str = "Proposed"


class RateCardIn(BaseModel):
    rate_card: dict[str, list[float]]


class InitiativeNoteIn(BaseModel):
    benefits: list[str] = []
    risks: list[str] = []
    constraints: list[str] = []
    owner: str = ""
    kpis: str = ""


class RepositoryIn(BaseModel):
    tooling: str = ""
    ownership: list[dict[str, str]] = []
    process: list[str] = []


@router.get("")
def get_roadmap(s: Session = Depends(get_session)):
    return views.roadmap(s)


@router.put("/acmm/{eid}")
def put_acmm(eid: str, body: AcmmIn, s: Session = Depends(get_session)):
    row = s.get(AcmmLevel, eid)
    if row is None:
        raise HTTPException(404, "Unknown ACMM element")
    row.level, row.source = body.level, "client"
    s.add(row)
    s.commit()
    return views.roadmap(s)


@router.post("/decisions")
def add_decision(body: DecisionIn, s: Session = Depends(get_session)):
    d = Decision(**body.model_dump(), source="client")
    s.add(d)
    s.commit()
    s.refresh(d)
    return d.model_dump(mode="json")


@router.put("/decisions/{did}")
def put_decision(did: int, body: DecisionIn, s: Session = Depends(get_session)):
    d = s.get(Decision, did)
    if d is None:
        raise HTTPException(404, "Unknown decision")
    for k, v in body.model_dump().items():
        setattr(d, k, v)
    d.source = "client"
    s.add(d)
    s.commit()
    return d.model_dump(mode="json")


@router.delete("/decisions/{did}")
def delete_decision(did: int, s: Session = Depends(get_session)):
    d = s.get(Decision, did)
    if d is None:
        raise HTTPException(404, "Unknown decision")
    s.delete(d)
    s.commit()
    return {"ok": True}


@router.put("/rate_card")
def put_rate_card(body: RateCardIn, s: Session = Depends(get_session)):
    for size, (lo, hi) in body.rate_card.items():
        if size not in ("S", "M", "L", "XL") or lo < 0 or hi < lo:
            raise HTTPException(422, f"Invalid band {size}")
    ov = s.get(SettingOverride, "config") or SettingOverride(key="config", value={})
    ov.value = deep_merge(ov.value, {"roadmap": {"rate_card_inr_cr": body.rate_card}})
    s.add(ov)
    s.commit()
    return views.roadmap(s)


@router.put("/initiatives/{iid}")
def put_initiative(iid: str, body: InitiativeNoteIn, s: Session = Depends(get_session)):
    if iid not in {t["id"] for t in effective_config(s)["themes"]}:
        raise HTTPException(404, "Unknown initiative")
    ov = s.get(SettingOverride, "initiative_notes") or SettingOverride(key="initiative_notes", value={})
    clean = lambda xs: [x.strip() for x in xs if x.strip()]  # noqa: E731
    ov.value = {**ov.value, iid: {"benefits": clean(body.benefits), "risks": clean(body.risks), "constraints": clean(body.constraints),
                                  "owner": body.owner.strip(), "kpis": body.kpis.strip()}}
    s.add(ov)
    s.commit()
    return views.roadmap(s)


@router.delete("/initiatives/{iid}")
def reset_initiative(iid: str, s: Session = Depends(get_session)):
    ov = s.get(SettingOverride, "initiative_notes")
    if ov and iid in ov.value:
        ov.value = {k: v for k, v in ov.value.items() if k != iid}
        s.add(ov)
        s.commit()
    return views.roadmap(s)


@router.put("/repository")
def put_repository(body: RepositoryIn, s: Session = Depends(get_session)):
    ov = s.get(SettingOverride, "repository") or SettingOverride(key="repository", value={})
    ov.value = {"tooling": body.tooling, "ownership": [o for o in body.ownership if o.get("view", "").strip()],
                "process": [p.strip() for p in body.process if p.strip()]}
    s.add(ov)
    s.commit()
    return views.roadmap(s)


class OperatingModelIn(BaseModel):
    model: str = ""
    rationale: str = ""
    roles: list[dict] = Field(default_factory=list)
    forums: list[dict] = Field(default_factory=list)
    engagement: list[str] = Field(default_factory=list)
    kpis: list[dict] = Field(default_factory=list)


@router.put("/operating-model")
def put_operating_model(body: OperatingModelIn, s: Session = Depends(get_session)):
    """EA operating model: roles and reporting lines, structure and forums, KPIs."""
    roles = [x for x in body.roles if str(x.get("title", "")).strip()]
    ids = {x.get("id") for x in roles}
    if len(ids) != len(roles) or any(x.get("reports_to") and x["reports_to"] not in ids for x in roles):
        raise HTTPException(422, "Each role needs a unique ID and must report to an existing role (or none)")
    if any(x.get("reports_to") == x.get("id") for x in roles):
        raise HTTPException(422, "A role cannot report to itself")
    base = effective_config(s)["governance"].get("operating_model", {})
    keep = ("current", "basis")
    ov = s.get(SettingOverride, "operating_model") or SettingOverride(key="operating_model", value={})
    ov.value = {"model": body.model.strip() or base.get("model", ""), "model_options": base.get("model_options", []),
                "rationale": body.rationale.strip(), "roles": roles,
                "forums": [f for f in body.forums if str(f.get("name", "")).strip()],
                "engagement": [x.strip() for x in body.engagement if x.strip()],
                "kpis": [{k: v for k, v in x.items() if k not in keep} for x in body.kpis if str(x.get("name", "")).strip()]}
    s.add(ov)
    s.commit()
    return views.roadmap(s)


@router.delete("/operating-model")
def reset_operating_model(s: Session = Depends(get_session)):
    ov = s.get(SettingOverride, "operating_model")
    if ov:
        s.delete(ov)
        s.commit()
    return views.roadmap(s)


@router.post("/briefs")
def briefs(s: Session = Depends(get_session)):
    return calls.initiative_briefs(s)
