from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlmodel import Session

from .. import views, xlsx
from ..db import get_session, load_state
from ..models import Application, Capability, DataDomain, Platform

router = APIRouter(prefix="/api", tags=["templates"])
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
NAMES = {"applications": "CIL_Application_Portfolio_Template.xlsx", "technology": "CIL_Technology_Portfolio_Template.xlsx",
         "questionnaire": "CIL_Capability_Questionnaire.xlsx", "data_domains": "CIL_Data_Domain_Template.xlsx"}


def _kind(kind: str) -> str:
    if kind not in xlsx.KINDS:
        raise HTTPException(404, f"Unknown template '{kind}'")
    return kind


def _file(content: bytes, name: str) -> Response:
    return Response(content, media_type=XLSX, headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/templates/{kind}")
def download_template(kind: str, s: Session = Depends(get_session)):
    return _file(xlsx.build_template(_kind(kind), load_state(s)), NAMES[kind])


@router.post("/templates/{kind}/upload")
async def upload_template(kind: str, file: UploadFile = File(...), s: Session = Depends(get_session)):
    kind = _kind(kind)
    state = load_state(s)
    rows, errors, warnings = xlsx.parse_upload(kind, await file.read(), state["cfg"])
    l2_ids = {c["id"] for l1 in state["caps"]["capabilities"] for c in l1["children"]}
    imported = created = 0
    for i, r in enumerate(rows):
        rid = str(r["id"]).strip()
        r["id"] = rid
        if kind == "questionnaire":
            row = s.get(Capability, rid)
            if row is None or row.level != 2:
                errors.append({"row": i + 2, "column": "Capability ID", "message": f"Unknown capability {rid}"})
                continue
            row.data = {**row.data, "q": [int(r[k]) for k in ("process", "digital", "data", "integration")],
                        "importance": int(r["importance"])}
            row.score_source = "client"
            s.add(row)
        elif kind == "applications":
            row = s.get(Application, rid)
            data = xlsx.app_from_row(r, row.data if row else None, l2_ids, warnings, i + 2)
            created += row is None
            if row is None:
                s.add(Application(id=rid, data=data, source="client"))
            else:
                row.data, row.source = data, "client"
                s.add(row)
        elif kind == "data_domains":
            row = s.get(DataDomain, rid)
            data = xlsx.data_from_row(r, row.data if row else None)
            created += row is None
            if row is None:
                s.add(DataDomain(id=rid, data=data, source="client"))
            else:
                row.data, row.source = data, "client"
                s.add(row)
        else:  # technology
            row = s.get(Platform, rid)
            data = {**(row.data if row else {}), **{k: v for k, v in r.items() if v is not None}}
            data["apps"] = xlsx.split_ids(r.get("apps")) if r.get("apps") else data.get("apps", [])
            created += row is None
            if row is None:
                s.add(Platform(id=rid, data=data, source="client"))
            else:
                row.data, row.source = data, "client"
                s.add(row)
        imported += 1
    s.commit()
    return {"kind": kind, "imported": imported, "created": created, "errors": errors, "warnings": warnings}


@router.get("/export/{screen}")
def export(screen: str, s: Session = Depends(get_session)):
    if screen == "business":
        b = views.business(s)
        rows = [{k: c[k] for k in ("id", "l1", "name", "owner", "maturity", "target", "importance", "ai_level", "band",
                                   "focus", "is_gap", "source")} | {"apps": [x["name"] for x in c["apps"]]}
                for l1 in b["l1"] for c in l1["children"]]
    elif screen == "applications":
        a = views.applications(s)
        rows = [{"id": x["id"], "name": x["name"], "vendor": x["vendor"], "hosting": x["hosting"], "caps": x["caps"],
                 "business_fit": x["computed"]["business_fit"], "technical_fit": x["computed"]["technical_fit"],
                 "disposition": x["computed"]["label"], "rationale": x["computed"]["rationale"],
                 "source": x["source"]} for x in a["apps"]]
    elif screen == "data_tech":
        d = views.data_tech(s)
        rows = [{"id": x["id"], "name": x["name"], "owner": x["owner"], "sor": x["sor"], "mdm": x["mdm"],
                 "pii": x["pii"], "classified": x["classified"], "score": x["computed"]["score"],
                 "band": x["computed"]["band"], "privacy_risk": x["computed"]["privacy_risk"], "source": x["source"]}
                for x in d["domains"]]
    elif screen in ("roadmap", "overview"):
        rows = [{k: g[k] for k in ("id", "kind", "title", "impact", "urgency", "priority", "adm_phase", "togaf_ref", "theme_name")}
                for g in views.roadmap(s)["gaps"]]
    elif screen == "vision":
        rows = [{k: i[k] for k in ("id", "name", "type", "status", "ready", "source")} for i in views.vision(s)["ai_initiatives"]]
    else:
        raise HTTPException(404, "Unknown screen")
    return _file(xlsx.export_table(screen, rows), f"CIL_{screen}.xlsx")
