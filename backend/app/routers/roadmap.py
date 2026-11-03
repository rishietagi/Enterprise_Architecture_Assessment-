from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session

from .. import views
from ..db import deep_merge, get_session
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


@router.post("/briefs")
def briefs(s: Session = Depends(get_session)):
    return calls.initiative_briefs(s)
