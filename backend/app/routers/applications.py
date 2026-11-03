from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from .. import views
from ..db import get_session, nat_key, read_seed
from ..llm import calls
from ..models import Application, Integration

from .gap_notes import GapNoteIn, drop_note, put_note

router = APIRouter(prefix="/api/applications", tags=["applications"])

# Tech DD intake fields + rule inputs. Rule inputs: caps, sor, criticality, lifecycle, bf, tf, in_scope, type, layer.
EDITABLE = {"name", "description", "vendor", "version", "type", "layer", "business_owner", "it_owner", "users", "caps",
            "hosting", "platform", "customisation", "licence_model", "support_model", "contract_end", "scalability", "dr",
            "standards_class", "lifecycle", "retire_date", "sor", "pii", "run_cost", "criticality", "bf", "tf",
            "in_scope", "issues", "note", "override", "tech_debt", "peak_load", "scale_model", "failover_tested",
            "key_person", "vendor_lock"}
DISPOSITIONS = set(views.DISPOSITIONS)


class AppPatch(BaseModel):
    fields: dict[str, Any]


class MapIn(BaseModel):
    app_ids: list[str] | None = None


class InterfaceIn(BaseModel):
    from_: str = Field(alias="from")
    to: str
    data: str = ""
    domain: str | None = None
    pattern: str = "API"
    frequency: str = "TBD"
    via: str = "Point-to-point"


def _validate(f: dict) -> None:
    bad = set(f) - EDITABLE
    if bad:
        raise HTTPException(422, f"Not editable: {', '.join(sorted(bad))}")
    for k, n in (("bf", 3), ("tf", 4)):
        if k in f and (len(f[k]) != n or any(not 1 <= int(v) <= 5 for v in f[k])):
            raise HTTPException(422, f"{k} must be {n} scores from 1 to 5")
    if "criticality" in f and not 1 <= int(f["criticality"]) <= 5:
        raise HTTPException(422, "criticality must be 1-5")
    ov = f.get("override")
    if ov and ov.get("disposition") and ov["disposition"] not in DISPOSITIONS:
        raise HTTPException(422, "Unknown disposition")
    if ov and ov.get("disposition") and not (ov.get("reason") or "").strip():
        raise HTTPException(422, "An override needs a reason")


@router.get("")
def get_applications(s: Session = Depends(get_session)):
    return views.applications(s)


@router.post("")
def add_application(body: AppPatch, s: Session = Depends(get_session)):
    f = dict(body.fields)
    if not str(f.get("name", "")).strip():
        raise HTTPException(422, "Name is required")
    _validate(f)
    ids = [int(a.id[1:]) for a in s.exec(select(Application)) if a.id[1:].isdigit()]
    aid = f"A{max(ids + [0]) + 1:02d}"
    data = {"id": aid, "vendor": "TBD", "type": "COTS", "layer": "Enterprise Apps", "caps": [], "hosting": "Unknown",
            "criticality": 3, "lifecycle": "Unknown", "bf": [3, 3, 3], "tf": [3, 3, 3, 3], "in_scope": True, "sor": [],
            **f}
    s.add(Application(id=aid, data=data, source="client"))
    s.commit()
    return {"ok": True, "id": aid}


@router.put("/{aid}")
def put_application(aid: str, body: AppPatch, s: Session = Depends(get_session)):
    row = s.get(Application, aid)
    if row is None:
        raise HTTPException(404, "Unknown application")
    _validate(body.fields)
    data = {**row.data, **body.fields}
    if "bf" in body.fields or "tf" in body.fields or "criticality" in body.fields:
        data["assumed_fields"] = [x for x in data.get("assumed_fields", []) if x not in body.fields]
    if body.fields.get("override") == {}:
        data.pop("override", None)
    row.data, row.source = data, "client"
    s.add(row)
    s.commit()
    return {"ok": True}


@router.delete("/{aid}")
def delete_application(aid: str, s: Session = Depends(get_session)):
    row = s.get(Application, aid)
    if row is None:
        raise HTTPException(404, "Unknown application")
    s.delete(row)
    for i in s.exec(select(Integration)):
        if aid in (i.data["from"], i.data["to"]):
            s.delete(i)
    s.commit()
    return {"ok": True}


@router.post("/map")
def map_caps(body: MapIn, s: Session = Depends(get_session)):
    return calls.map_apps(s, body.app_ids)


# --------------------------------------------------------------------------- Interface Catalog
def _check_ends(s: Session, body: InterfaceIn) -> None:
    ext = {x["id"] for x in read_seed()["external"]}
    for end in (body.from_, body.to):
        if end not in ext and s.get(Application, end) is None:
            raise HTTPException(422, f"Unknown application {end}")
    if body.from_ == body.to:
        raise HTTPException(422, "An interface needs two different ends")
    if body.pattern not in read_seed()["integration_meta"]["patterns"]:
        raise HTTPException(422, "Unknown pattern")


@router.post("/interfaces")
def add_interface(body: InterfaceIn, s: Session = Depends(get_session)):
    _check_ends(s, body)
    ids = sorted((i.id for i in s.exec(select(Integration))), key=nat_key)
    iid = f"I{max([int(i[1:]) for i in ids if i[1:].isdigit()] + [0]) + 1:02d}"
    s.add(Integration(id=iid, data={"id": iid, **body.model_dump(by_alias=True)}, source="client"))
    s.commit()
    return views.applications(s)


@router.put("/interfaces/{iid}")
def put_interface(iid: str, body: InterfaceIn, s: Session = Depends(get_session)):
    row = s.get(Integration, iid)
    if row is None:
        raise HTTPException(404, "Unknown interface")
    _check_ends(s, body)
    row.data, row.source = {"id": iid, **body.model_dump(by_alias=True)}, "client"
    s.add(row)
    s.commit()
    return views.applications(s)


@router.delete("/interfaces/{iid}")
def delete_interface(iid: str, s: Session = Depends(get_session)):
    row = s.get(Integration, iid)
    if row is None:
        raise HTTPException(404, "Unknown interface")
    s.delete(row)
    s.commit()
    return views.applications(s)


@router.put("/gaps/{gid}")
def put_gap(gid: str, body: GapNoteIn, s: Session = Depends(get_session)):
    """Edit a generated gap's description, target-state hypothesis or severity (overlay on the rule output)."""
    if not gid.startswith(("AG-", "AT-")):
        raise HTTPException(404, "Unknown gap")
    put_note(s, "app_gap_notes", gid, body)
    return views.applications(s)


@router.delete("/gaps/{gid}")
def reset_gap(gid: str, s: Session = Depends(get_session)):
    drop_note(s, "app_gap_notes", gid)
    return views.applications(s)
