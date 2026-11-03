from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session

from .. import views
from ..db import get_session
from ..models import PlanTask, SettingOverride


router = APIRouter(prefix="/api/approach", tags=["approach"])


class PlanStatusIn(BaseModel):
    status: Literal["planned", "in_progress", "done", "at_risk", "milestone"]


class ScopeItem(BaseModel):
    n: int
    title: str = Field(min_length=2)
    icon: str = "discovery"
    activities: str = ""


class ScopeIn(BaseModel):
    requirement: str = Field(min_length=5)
    objective: str = Field(min_length=5)
    items: list[ScopeItem] = Field(min_length=1)


@router.put("/scope")
def put_scope(body: ScopeIn, s: Session = Depends(get_session)):
    ov = s.get(SettingOverride, "scope_of_work") or SettingOverride(key="scope_of_work", value={})
    items = [dict(x.model_dump(), n=i) for i, x in enumerate(body.items, 1)]
    ov.value = {"requirement": body.requirement.strip(), "objective": body.objective.strip(), "items": items}
    s.add(ov)
    s.commit()
    return views.approach(s)


@router.post("/scope/reset")
def reset_scope(s: Session = Depends(get_session)):
    ov = s.get(SettingOverride, "scope_of_work")
    if ov:
        s.delete(ov)
        s.commit()
    return views.approach(s)


@router.get("")
def get_approach(s: Session = Depends(get_session)):
    return views.approach(s)


@router.put("/plan/{tid}")
def put_plan_status(tid: str, body: PlanStatusIn, s: Session = Depends(get_session)):
    t = s.get(PlanTask, tid)
    if t is None:
        raise HTTPException(404, "Unknown plan activity")
    t.status, t.source = body.status, "client"
    s.add(t)
    s.commit()
    return views.approach(s)
