from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from .. import views
from ..db import get_session
from ..models import PlanTask

router = APIRouter(prefix="/api/approach", tags=["approach"])


class PlanStatusIn(BaseModel):
    status: Literal["planned", "in_progress", "done", "at_risk", "milestone"]


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
