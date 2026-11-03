import json
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from .. import context_docs, views
from ..config import get_settings
from ..db import deep_merge, effective_config, get_session
from ..llm import calls
from ..models import ContextDoc, Guideline, PlanTask, PrincipleSelection, SettingOverride, VisionDoc

router = APIRouter(prefix="/api/vision", tags=["vision"])
PREFIX = {"principle": "P-CIL-", "guardrail": "G-", "pattern": "PT-"}


class VisionDocIn(BaseModel):
    vision_statement: str
    ai_ambition: str
    objectives: list[str]
    success_measures: list[str]
    citations: list[dict] = []
    mode: str = ""


class PrincipleIn(BaseModel):
    adopted: bool


class GuidelineIn(BaseModel):
    kind: Literal["principle", "guardrail", "pattern"]
    name: str = Field(min_length=2)
    statement: str = ""
    category: str = ""
    togaf_basis: str = ""
    rationale: str = ""
    implications: list[str] = []
    enforced_by: str = ""
    use: str = ""
    principle: str = ""
    active: bool = True


class RulesIn(BaseModel):
    threshold: float | None = Field(default=None, ge=1, le=5)
    bf_weights: list[float] | None = None
    tf_weights: list[float] | None = None
    labels: dict[str, dict[str, str]] | None = None
    rules: list[dict[str, Any]] | None = None  # [{id, enabled, params}]
    capability: dict[str, float] | None = None  # gap_importance_min, gap_maturity_max


@router.get("")
def get_vision(s: Session = Depends(get_session)):
    return views.vision(s)


class PlanStatusIn(BaseModel):
    status: Literal["planned", "in_progress", "done", "at_risk", "milestone"]


@router.put("/plan/{tid}")
def put_plan_status(tid: str, body: PlanStatusIn, s: Session = Depends(get_session)):
    t = s.get(PlanTask, tid)
    if t is None:
        raise HTTPException(404, "Unknown plan activity")
    t.status, t.source = body.status, "client"
    s.add(t)
    s.commit()
    return views.vision(s)


@router.put("/doc")
def put_doc(body: VisionDocIn, s: Session = Depends(get_session)):
    doc = s.get(VisionDoc, 1) or VisionDoc(id=1)
    for k, v in body.model_dump().items():
        setattr(doc, k, v)
    doc.source = "client" if body.mode in ("", "edited") else "assumed"
    doc.updated = datetime.now(timezone.utc)
    s.add(doc)
    s.commit()
    return views.vision_doc(s)


@router.put("/principles/{pid}")
def put_principle(pid: str, body: PrincipleIn, s: Session = Depends(get_session)):
    if not (pid.startswith("TOGAF-") or pid.startswith("P-")):
        raise HTTPException(404, "Unknown principle")
    row = s.get(PrincipleSelection, pid) or PrincipleSelection(id=pid)
    row.adopted = body.adopted
    s.add(row)
    s.commit()
    return views.principles_view(s, views.load_state(s))


# --------------------------------------------------------------------------- principles, guardrails, patterns
def _payload(body: GuidelineIn) -> dict:
    d = body.model_dump(exclude={"kind"})
    keep = {"principle": ("name", "statement", "category", "togaf_basis", "rationale", "implications"),
            "guardrail": ("name", "statement", "category", "enforced_by", "active"),
            "pattern": ("name", "use", "principle", "active")}[body.kind]
    return {k: d[k] for k in keep}


@router.post("/guidelines")
def add_guideline(body: GuidelineIn, s: Session = Depends(get_session)):
    pre = PREFIX[body.kind]
    nums = [int(g.id[len(pre):]) for g in s.exec(select(Guideline).where(Guideline.kind == body.kind))
            if g.id.startswith(pre) and g.id[len(pre):].isdigit()]
    gid = f"{pre}{max(nums + [0]) + 1:02d}"
    s.add(Guideline(id=gid, kind=body.kind, data={"id": gid, **_payload(body)}, source="client"))
    if body.kind == "principle":
        s.add(PrincipleSelection(id=gid, adopted=True))
    s.commit()
    return views.vision(s)


@router.put("/guidelines/{gid}")
def put_guideline(gid: str, body: GuidelineIn, s: Session = Depends(get_session)):
    row = s.get(Guideline, gid)
    if row is None:
        raise HTTPException(404, "Unknown guideline")
    row.data, row.source = {**row.data, **_payload(body)}, "client"
    s.add(row)
    s.commit()
    return views.vision(s)


@router.delete("/guidelines/{gid}")
def delete_guideline(gid: str, s: Session = Depends(get_session)):
    row = s.get(Guideline, gid)
    if row is None:
        raise HTTPException(404, "Unknown guideline")
    s.delete(row)
    sel = s.get(PrincipleSelection, gid)
    if sel:
        s.delete(sel)
    s.commit()
    return views.vision(s)


# --------------------------------------------------------------------------- configurable rules
@router.put("/rules")
def put_rules(body: RulesIn, s: Session = Depends(get_session)):
    cfg = effective_config(s)
    patch: dict[str, Any] = {"rationalization": {}, "capability_rules": {}}
    rp = patch["rationalization"]
    if body.threshold is not None:
        rp["threshold"] = body.threshold
    for k, n in (("bf_weights", 3), ("tf_weights", 4)):
        w = getattr(body, k)
        if w is not None:
            if len(w) != n or any(x < 0 for x in w) or sum(w) <= 0:
                raise HTTPException(422, f"{k} needs {n} non-negative weights")
            rp[k] = w
    if body.labels is not None:
        known = cfg["rationalization"].get("labels", {})
        rp["labels"] = {k: {"label": v.get("label") or known.get(k, {}).get("label", k),
                            "desc": v.get("desc", known.get(k, {}).get("desc", ""))} for k, v in body.labels.items() if k in known}
    if body.rules is not None:
        by_id = {x["id"]: x for x in body.rules}
        merged = []
        for x in cfg["rationalization"].get("rules", []):
            u = by_id.get(x["id"], {})
            y = dict(x)
            if "enabled" in u and not x.get("locked"):
                y["enabled"] = bool(u["enabled"])
            if "params" in u and isinstance(u["params"], dict):
                y["params"] = {**x.get("params", {}), **{k: v for k, v in u["params"].items() if k in x.get("params", {})}}
            merged.append(y)
        rp["rules"] = merged
    if body.capability:
        for k in ("gap_importance_min", "gap_maturity_max"):
            if k in body.capability:
                patch["capability_rules"][k] = body.capability[k]
    ov = s.get(SettingOverride, "config") or SettingOverride(key="config", value={})
    ov.value = deep_merge(ov.value, {k: v for k, v in patch.items() if v})
    s.add(ov)
    s.commit()
    return views.vision(s)


@router.post("/rules/reset")
def reset_rules(s: Session = Depends(get_session)):
    ov = s.get(SettingOverride, "config")
    if ov:
        v = dict(ov.value)
        v["rationalization"] = {k: x for k, x in v.get("rationalization", {}).items()
                                if k not in ("bf_weights", "tf_weights", "labels", "rules", "threshold")}
        v["capability_rules"] = {k: x for k, x in v.get("capability_rules", {}).items()
                                 if k not in ("gap_importance_min", "gap_maturity_max")}
        ov.value = {k: x for k, x in v.items() if x or k not in ("rationalization", "capability_rules")}
        s.add(ov)
        s.commit()
    return views.vision(s)


@router.post("/draft")
def draft(s: Session = Depends(get_session)):
    return calls.draft_vision(s)


# --------------------------------------------------------------------------- vision context and statements
class ContextIn(BaseModel):
    text: str = Field(default="", max_length=20000)


class StatementIn(BaseModel):
    title: str = ""
    statement: str = Field(min_length=3)
    drivers: list[str] = []
    evidence: list[str] = []
    cites: list[int] = []


class StatementsIn(BaseModel):
    statements: list[StatementIn] = Field(max_length=8)
    mode: str = "edited"
    citations: list[dict] | None = None


class SuggestIn(BaseModel):
    hint: str = Field(default="", max_length=300)


def _ctx(s: Session) -> SettingOverride:
    return s.get(SettingOverride, "vision_context") or SettingOverride(key="vision_context", value={})


@router.put("/context")
def put_context(body: ContextIn, s: Session = Depends(get_session)):
    ov = _ctx(s)
    ov.value = {**ov.value, "text": body.text}
    s.add(ov)
    s.commit()
    return views.vision(s)


@router.post("/context/docs")
async def upload_docs(files: list[UploadFile] = File(...), s: Session = Depends(get_session)):
    """Read uploaded documents into the vision context (text only is kept)."""
    added, errors = [], []
    for f in files[:10]:
        data = await f.read()
        if len(data) > 25 * 1024 * 1024:
            errors.append(f"{f.filename}: larger than 25 MB")
            continue
        try:
            text = context_docs.extract(f.filename or "file", data)
        except Exception as e:  # noqa: BLE001 - report unreadable files back to the user
            errors.append(f"{f.filename}: {e}")
            continue
        if not text.strip():
            errors.append(f"{f.filename}: no readable text (scanned PDF?)")
            continue
        s.add(ContextDoc(name=f.filename or "file", kind=context_docs.kind_of(f.filename or ""), size=len(data), text=text))
        added.append(f.filename)
    s.commit()
    return dict(views.vision(s), added=added, errors=errors)


@router.post("/context/sample")
def load_sample_context(s: Session = Depends(get_session)):
    """One-click demo: sample notes plus three sample documents (replaces earlier samples, keeps uploaded files)."""
    sample = json.loads((get_settings().seed_dir / "context_samples.json").read_text(encoding="utf-8"))
    for d in s.exec(select(ContextDoc)):
        if d.name.startswith("Sample - "):
            s.delete(d)
    for d in sample["docs"]:
        s.add(ContextDoc(name=d["name"], kind=d["kind"], size=len(d["text"].encode()), text=d["text"], source="assumed"))
    ov = _ctx(s)
    ov.value = {**ov.value, "text": sample["text"]}
    s.add(ov)
    s.commit()
    return dict(views.vision(s), added=[d["name"] for d in sample["docs"]], errors=[])


@router.delete("/context/docs/{did}")
def delete_doc(did: int, s: Session = Depends(get_session)):
    d = s.get(ContextDoc, did)
    if d is None:
        raise HTTPException(404, "Unknown document")
    s.delete(d)
    s.commit()
    return views.vision(s)


@router.post("/statements/generate")
def generate_statements(s: Session = Depends(get_session)):
    """Five Architecture Vision statements from the context (AI, or the deterministic draft without a key). Not saved."""
    return calls.vision_statements(s)


@router.put("/statements")
def put_statements(body: StatementsIn, s: Session = Depends(get_session)):
    ov = _ctx(s)
    sts = [x.model_dump() for x in body.statements]
    ov.value = {**ov.value, "statements": sts, "mode": body.mode,
                **({"citations": body.citations} if body.citations is not None else {}),
                "source": "client" if body.mode in ("", "edited") else "assumed",
                "updated": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    s.add(ov)
    doc = s.get(VisionDoc, 1) or VisionDoc(id=1)  # keep the vision document (export, ADM status) in step
    doc.vision_statement = "\n".join(f"{x['title']}: {x['statement']}" if x["title"] else x["statement"] for x in sts)
    doc.source, doc.mode, doc.updated = ov.value["source"], body.mode, datetime.now(timezone.utc)
    s.add(doc)
    s.commit()
    return views.vision(s)


@router.post("/principles/suggest")
def suggest_principle(body: SuggestIn, s: Session = Depends(get_session)):
    return calls.suggest_principle(s, body.hint)


@router.get("/export.md", response_class=PlainTextResponse)
def export_md(s: Session = Depends(get_session)):
    v = views.vision(s)
    d = v["vision_doc"]
    lines = ["# CIL Architecture Vision", "", f"_{v['engagement']['client']} · {v['engagement']['horizon']}_", "",
             "## Request", v["engagement"]["request"], ""]
    if v["context"]["statements"]:
        lines += ["## Architecture vision statements"] + [f"{i}. **{x['title']}**: {x['statement']}" for i, x in enumerate(v["context"]["statements"], 1)] + [""]
    lines += ["## Business drivers"]
    lines += [f"- {x['driver']} ({x['source']})" for x in v["drivers"]]
    lines += ["", "## Digital focus areas"] + [f"- **{f['name']}**: {f['detail']}" for f in v["focus_areas"]]
    lines += ["", "## Vision statement", d["vision_statement"] or "_Not drafted_", "", "## AI ambition",
              d["ai_ambition"] or "_Not drafted_", "", "## Objectives"] + [f"- {o}" for o in d["objectives"]]
    lines += ["", "## Success measures"] + [f"- {m}" for m in d["success_measures"]]
    lines += ["", "## Adopted principles"] + [f"- {p['name']}" for p in v["principles"]["togaf"] + v["principles"]["cil"] if p["adopted"]]
    lines += ["", "## Guardrails"] + [f"- **{g['name']}**: {g['statement']}" for g in v["guardrails"] if g.get("active", True)]
    lines += ["", "## Rationalization rules"] + [f"- {r['id']} {r['name']} ({'on' if r.get('enabled') else 'off'}): {r['why']}"
                                                 for r in v["rules"]["rules"]]
    if d["citations"]:
        lines += ["", "## TOGAF references"] + [f"[{c.get('n')}] {c.get('label')}" for c in d["citations"]]
    return "\n".join(lines) + "\n"
