"""Editable reference architecture views (application, data, infrastructure): save the whole view or reset it to the seed."""
import copy
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlmodel import Session

from .. import views
from ..db import get_session, read_seed
from ..models import ArchView

router = APIRouter(prefix="/api/arch_views", tags=["arch_views"])


class Block(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=160)
    status: Literal["ok", "partial", "missing", "validate"] = "partial"
    apps: list[str] = []
    note: str = ""
    span: int = Field(1, ge=1, le=8)
    group: str | None = None
    check: str | None = None
    hosting: str | None = None


class Layer(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=120)
    rows: list[list[Block]]


class Aside(BaseModel):
    title: str
    boxes: list[Block]


class Edge(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    from_: str = Field(alias="from")
    to: str


class ViewIn(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    subtitle: str = ""
    functions: list[str] = []
    layers: list[Layer]
    aside: Aside | None = None
    edges: list[Edge] = []

    @field_validator("layers")
    @classmethod
    def unique_ids(cls, v: list[Layer]) -> list[Layer]:
        ids = [b.id for ly in v for row in ly.rows for b in row]
        if len(ids) != len(set(ids)):
            raise ValueError("block ids must be unique")
        return v


def _screen(s: Session, row: ArchView) -> dict:
    return views.SCREENS[row.screen](s)


@router.put("/{vid}")
def put_view(vid: str, body: ViewIn, s: Session = Depends(get_session)):
    row = s.get(ArchView, vid)
    if row is None:
        raise HTTPException(404, "Unknown architecture view")
    data = body.model_dump(by_alias=True)
    ids = {b["id"] for ly in data["layers"] for r in ly["rows"] for b in r} | {b["id"] for b in (data.get("aside") or {}).get("boxes", [])}
    data["edges"] = [e for e in data["edges"] if e["from"] in ids and e["to"] in ids and e["from"] != e["to"]]
    row.data = {**{k: v for k, v in row.data.items() if k in ("id", "screen", "kind")}, **data}
    row.source = "client"
    s.add(row)
    s.commit()
    return _screen(s, row)


@router.post("/{vid}/reset")
def reset_view(vid: str, s: Session = Depends(get_session)):
    row = s.get(ArchView, vid)
    seed = next((v for v in read_seed()["ref_views"] if v["id"] == vid), None)
    if row is None or seed is None:
        raise HTTPException(404, "Unknown architecture view")
    row.data, row.source = copy.deepcopy(seed), seed.get("source", "assumed")
    s.add(row)
    s.commit()
    return _screen(s, row)
