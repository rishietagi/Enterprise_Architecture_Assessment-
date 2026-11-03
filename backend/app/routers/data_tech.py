from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from .. import views
from ..db import get_session
from ..models import DataDomain, TechCheck

router = APIRouter(prefix="/api/data_tech", tags=["data_tech"])


class CheckIn(BaseModel):
    status: Literal["pass", "partial", "fail", "unknown"]


class DomainIn(BaseModel):
    owner: bool | None = None
    mdm: Literal["none", "partial", "full"] | None = None
    lineage: bool | None = None
    classified: bool | None = None
    quality: list[int] | None = None


@router.get("")
def get_data_tech(s: Session = Depends(get_session)):
    return views.data_tech(s)


@router.put("/checks/{cid}")
def put_check(cid: str, body: CheckIn, s: Session = Depends(get_session)):
    row = s.get(TechCheck, cid)
    if row is None:
        raise HTTPException(404, "Unknown check")
    row.status, row.source = body.status, "client"
    s.add(row)
    s.commit()
    return views.data_tech(s)


@router.put("/domains/{did}")
def put_domain(did: str, body: DomainIn, s: Session = Depends(get_session)):
    row = s.get(DataDomain, did)
    if row is None:
        raise HTTPException(404, "Unknown data domain")
    patch = body.model_dump(exclude_none=True)
    if "quality" in patch and (len(patch["quality"]) != 3 or any(not 1 <= q <= 5 for q in patch["quality"])):
        raise HTTPException(422, "quality must be three 1-5 scores")
    row.data = {**row.data, **patch}
    row.source = "client"
    s.add(row)
    s.commit()
    return views.data_tech(s)
