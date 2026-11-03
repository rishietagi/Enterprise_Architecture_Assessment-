"""IT Budget: the IT cost baseline inputs (overall IT costs, capex by initiative, opex by cost head, business factors)."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session

from .. import views
from ..db import get_session
from ..models import SettingOverride

router = APIRouter(prefix="/api/budget", tags=["budget"])


class Line(BaseModel):
    id: str = Field(min_length=1, max_length=24)
    name: str = Field(min_length=1, max_length=160)
    values: list[float | None]
    theme: str | None = None
    kind: str | None = None
    unit: str | None = None


class BudgetIn(BaseModel):
    fys: list[str] = Field(min_length=2, max_length=8)
    overall: list[Line]
    capex: list[Line]
    opex: list[Line]
    factors: list[Line]


@router.get("")
def get_budget(s: Session = Depends(get_session)):
    return views.budget(s)


@router.put("")
def put_budget(body: BudgetIn, s: Session = Depends(get_session)):
    n = len(body.fys)
    if len(set(body.fys)) != n:
        raise HTTPException(422, "Financial years must be unique")
    if {x.id for x in body.overall} != {"opex", "salaries", "capex"}:
        raise HTTPException(422, "Overall IT costs must keep IT Opex, IT Salaries and IT Capex")
    data = body.model_dump()
    for k in ("overall", "capex", "opex", "factors"):
        ids = [x["id"] for x in data[k]]
        if len(ids) != len(set(ids)):
            raise HTTPException(422, f"Duplicate ids in {k}")
        for x in data[k]:
            if any(v is not None and v < 0 for v in x["values"]):
                raise HTTPException(422, f"{x['name']}: values cannot be negative")
            x["values"] = (x["values"] + [None] * n)[:n]
    ov = s.get(SettingOverride, "budget") or SettingOverride(key="budget", value={})
    ov.value = {**data, "actual_suffix": "A", "source": "client"}
    s.add(ov)
    s.commit()
    return views.budget(s)


@router.post("/reset")
def reset_budget(s: Session = Depends(get_session)):
    ov = s.get(SettingOverride, "budget")
    if ov:
        s.delete(ov)
        s.commit()
    return views.budget(s)
