"""Data & Technology inputs: data domains, technology platforms, sites and network, landing zones and check statuses."""
import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from .. import views
from ..db import get_session, nat_key
from ..models import Application, DataDomain, Platform, SettingOverride, TechCheck

from .gap_notes import GapNoteIn, drop_note, put_note

router = APIRouter(prefix="/api/data_tech", tags=["data_tech"])


class CheckIn(BaseModel):
    status: Literal["pass", "partial", "fail", "unknown"]


class DomainIn(BaseModel):
    name: str | None = Field(None, min_length=2)
    description: str | None = None
    owner: bool | None = None
    steward: str | None = None
    sor: str | None = None
    consumers: list[str] | None = None
    mdm: Literal["none", "partial", "full"] | None = None
    lineage: bool | None = None
    pii: bool | None = None
    classified: bool | None = None
    quality: list[int] | None = None
    data_types: list[str] | None = None
    sensitivity: str | None = None
    volume_hint: str | None = None
    retention: str | None = None


class PlatformIn(BaseModel):
    name: str = Field(min_length=2)
    category: str = ""
    standard: str = "Non-Standard"
    lifecycle: str = "Unknown"
    version: str = ""
    location: str = ""


class Site(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=2)
    type: str = ""
    source: str = "client"


class Link(BaseModel):
    id: str = Field(min_length=1)
    model_config = {"populate_by_name": True}
    from_: str = Field(alias="from")
    to: str
    type: str = "TBD"
    note: str = ""
    source: str = "client"


class SitesIn(BaseModel):
    locations: list[Site]
    network: list[Link]


class ZonesIn(BaseModel):
    items: list[dict]


def _next_id(ids: list[str], prefix: str, width: int = 2) -> str:
    nums = [int(m.group(1)) for i in ids if (m := re.fullmatch(re.escape(prefix) + r"(\d+)", i))]
    return f"{prefix}{max(nums + [0]) + 1:0{width}d}"


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


def _check_domain(patch: dict) -> None:
    if "quality" in patch and (len(patch["quality"]) != 3 or any(not 1 <= q <= 5 for q in patch["quality"])):
        raise HTTPException(422, "quality must be three 1-5 scores")


@router.put("/domains/{did}")
def put_domain(did: str, body: DomainIn, s: Session = Depends(get_session)):
    row = s.get(DataDomain, did)
    if row is None:
        raise HTTPException(404, "Unknown data domain")
    patch = body.model_dump(exclude_none=True)
    _check_domain(patch)
    row.data = {**row.data, **patch}
    row.source = "client"
    s.add(row)
    s.commit()
    return views.data_tech(s)


@router.post("/domains")
def add_domain(body: DomainIn, s: Session = Depends(get_session)):
    if not body.name:
        raise HTTPException(422, "name is required")
    did = _next_id([d.id for d in s.exec(select(DataDomain))], "DD-")
    data = {"id": did, "name": body.name, "owner": False, "sor": "", "mdm": "none", "quality": [3, 3, 3], "lineage": False,
            "pii": False, "classified": False, "consumers": [], "data_types": [], "sensitivity": "Internal"} | body.model_dump(exclude_none=True)
    _check_domain(data)
    s.add(DataDomain(id=did, data=data, source="client"))
    s.commit()
    return dict(views.data_tech(s), added=did)


@router.delete("/domains/{did}")
def delete_domain(did: str, s: Session = Depends(get_session)):
    row = s.get(DataDomain, did)
    if row is None:
        raise HTTPException(404, "Unknown data domain")
    s.delete(row)
    for a in s.exec(select(Application)):
        if did in a.data.get("sor", []):
            a.data = {**a.data, "sor": [x for x in a.data["sor"] if x != did]}
            s.add(a)
    s.commit()
    return views.data_tech(s)


@router.post("/platforms")
def add_platform(body: PlatformIn, s: Session = Depends(get_session)):
    pid = _next_id([p.id for p in s.exec(select(Platform))], "T")
    s.add(Platform(id=pid, data={"id": pid, **body.model_dump()}, source="client"))
    s.commit()
    return views.data_tech(s)


@router.put("/platforms/{pid}")
def put_platform(pid: str, body: PlatformIn, s: Session = Depends(get_session)):
    row = s.get(Platform, pid)
    if row is None:
        raise HTTPException(404, "Unknown platform")
    row.data, row.source = {**row.data, **body.model_dump()}, "client"
    s.add(row)
    s.commit()
    return views.data_tech(s)


@router.delete("/platforms/{pid}")
def delete_platform(pid: str, s: Session = Depends(get_session)):
    row = s.get(Platform, pid)
    if row is None:
        raise HTTPException(404, "Unknown platform")
    s.delete(row)
    s.commit()
    return views.data_tech(s)


@router.put("/sites")
def put_sites(body: SitesIn, s: Session = Depends(get_session)):
    ids = [x.id for x in body.locations]
    if len(ids) != len(set(ids)):
        raise HTTPException(422, "Site ids must be unique")
    bad = [n.id for n in body.network if n.from_ not in ids or n.to not in ids or n.from_ == n.to]
    if bad:
        raise HTTPException(422, f"Links must join two different sites: {', '.join(bad)}")
    ov = s.get(SettingOverride, "sites") or SettingOverride(key="sites", value={})
    ov.value = {"locations": [x.model_dump() for x in body.locations],
                "network": sorted([x.model_dump(by_alias=True) for x in body.network], key=lambda n: nat_key(n["id"]))}
    s.add(ov)
    s.commit()
    return views.data_tech(s)


@router.put("/landing_zones")
def put_zones(body: ZonesIn, s: Session = Depends(get_session)):
    for z in body.items:
        if not str(z.get("name", "")).strip() or z.get("status") not in ("ok", "partial", "missing", "validate"):
            raise HTTPException(422, "Each landing zone needs a name and a valid status")
    ov = s.get(SettingOverride, "landing_zones") or SettingOverride(key="landing_zones", value={})
    ov.value = {"items": [{**z, "source": "client"} for z in body.items]}
    s.add(ov)
    s.commit()
    return views.data_tech(s)


@router.put("/gaps/{gid}")
def put_gap(gid: str, body: GapNoteIn, s: Session = Depends(get_session)):
    """Edit a generated gap's description, target-state hypothesis or severity (overlay on the rule output)."""
    if not gid.startswith(("DG-", "DT-")):
        raise HTTPException(404, "Unknown gap")
    put_note(s, "dt_gap_notes", gid, body)
    return views.data_tech(s)


@router.delete("/gaps/{gid}")
def reset_gap(gid: str, s: Session = Depends(get_session)):
    drop_note(s, "dt_gap_notes", gid)
    return views.data_tech(s)
