import copy
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from .. import discovery, rules, views
from ..db import get_session, load_state, nat_key, read_seed
from ..discovery import generate_questions
from ..models import Application, Capability, ProcessModel, SettingOverride, Survey

router = APIRouter(prefix="/api/business", tags=["business"])
NODE_FIELDS = {"name", "description", "owner", "depends_on", "automation", "focus", "parent"}


class CapabilityIn(BaseModel):
    q: list[int] = Field(min_length=4, max_length=4)
    importance: int = Field(ge=1, le=5)
    apps: list[str] | None = None  # applications supporting the capability (updates each app's caps)
    automation: str | None = None
    owner: str | None = None


class NodeIn(BaseModel):
    level: int = Field(ge=0, le=3)
    parent: str | None = None
    name: str = Field(min_length=2)
    description: str = ""
    owner: str = ""
    ref: str | None = None


class NodePatch(BaseModel):
    fields: dict


class FromRefIn(BaseModel):
    ref: str  # standard-practice L1, L2 or L3 id
    parent: str | None = None  # CIL L1 for an L2 (defaults to the L1 linked to the reference parent)


def _next_id(s: Session, level: int, parent: str | None) -> str:
    ids = [c.id for c in s.exec(select(Capability).where(Capability.level == level))]
    if level == 0:
        return f"L0-{max([int(i.split('-')[1]) for i in ids if i.split('-')[1].isdigit()] + [0]) + 1}"
    if level == 1:
        return f"C{max([int(i[1:]) for i in ids if i[1:].isdigit()] + [0]) + 1:02d}"
    kids = [int(i[len(parent) + 1:]) for i in ids if i.startswith(f"{parent}.") and i[len(parent) + 1:].isdigit()]
    return f"{parent}.{max(kids + [0]) + 1}"


def _add(s: Session, level: int, parent: str | None, name: str, **extra) -> Capability:
    if level > 0:
        p = s.get(Capability, parent or "")
        if p is None or p.level != level - 1:
            raise HTTPException(422, f"Parent must be an existing L{level - 1} capability")
    cid = _next_id(s, level, parent)
    data = {"id": cid, "level": level, "parent": parent, "name": name, **extra}
    if level == 1:
        data["l0"] = parent
    if level == 2:
        data.setdefault("depends_on", [])
    row = Capability(id=cid, level=level, data=data, source="client", score_source="client")
    s.add(row)
    return row


@router.get("")
def get_business(s: Session = Depends(get_session)):
    return views.business(s)


# --------------------------------------------------------------------------- current-state discovery (L3 surveys)
class QuestionsIn(BaseModel):
    questions: list[dict] = Field(min_length=1)


class SendIn(BaseModel):
    to_role: str = ""
    to: str = ""
    subject: str = ""
    kind: Literal["initial", "explain", "redirect"] = "initial"


class ResponseIn(BaseModel):
    outcome: Literal["submitted", "redirected", "walkthrough"]
    channel: Literal["email", "workshop"] = "email"
    answers: dict = {}
    note: str = ""
    redirect_to: str | None = None
    by: str = ""


class CommentsIn(BaseModel):
    comments: dict[str, str]


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")


def _l3(s: Session, lid: str) -> Capability:
    row = s.get(Capability, lid)
    if row is None or row.level != 3:
        raise HTTPException(404, "Unknown L3 capability")
    return row


def _survey(s: Session, lid: str) -> Survey:
    sv = s.get(Survey, lid)
    if sv is None:
        raise HTTPException(409, "Generate the questionnaire first")
    return sv


def _log(sv: Survey, event: str, by: str, msg: str = "", **fields) -> None:
    d = dict(sv.data)
    d["history"] = [*d.get("history", []), {"at": _now(), "event": event, "by": by, **({"note": msg} if msg else {})}]
    sv.data = {**d, **fields}


def _generate(s: Session, row: Capability) -> Survey:
    l2 = s.get(Capability, row.data["parent"])
    sv = s.get(Survey, row.id) or Survey(id=row.id, data={}, source="client")
    sv.data = {"id": row.id, "status": "draft", "finalised": False, "channel": "email", "answers": {}, "outcome": None, "redirect_to": None, "note": "",
               "recipient": {"role": row.data.get("owner") or l2.data.get("owner", ""), "email": ""},
               "questions": generate_questions(dict(row.data, id=row.id)), "history": []}
    _log(sv, "generated", discovery.REPLY_TO)
    sv.source = "client"
    s.add(sv)
    return sv


@router.post("/discovery/{lid}/generate")
def generate(lid: str, s: Session = Depends(get_session)):
    """Questionnaire for one L3 (template + contextual question); for an L2 id, every L3 under it without one."""
    row = s.get(Capability, lid)
    if row is not None and row.level == 2:
        kids = [r for r in s.exec(select(Capability).where(Capability.level == 3)) if r.data.get("parent") == lid]
        for k in kids:
            if s.get(Survey, k.id) is None:
                _generate(s, k)
    else:
        _generate(s, _l3(s, lid))
    s.commit()
    return views.business(s)


@router.put("/discovery/{lid}/questions")
def put_questions(lid: str, body: QuestionsIn, s: Session = Depends(get_session)):
    sv = _survey(s, lid)
    for q in body.questions:
        if not q.get("id") or not str(q.get("text", "")).strip():
            raise HTTPException(422, "Every question needs an id and text")
    if sv.data.get("status") not in ("draft", "walkthrough", "redirected"):
        raise HTTPException(409, "The questionnaire has already gone out; edit it only before it is sent")
    _log(sv, "edited", discovery.REPLY_TO, f"{len(body.questions)} questions", questions=body.questions, finalised=False)
    s.add(sv)
    s.commit()
    return views.business(s)


@router.post("/discovery/{lid}/finalise")
def finalise(lid: str, s: Session = Depends(get_session)):
    """Lock the reviewed questionnaire so it can be orchestrated. For an L2 id, every drafted L3 under it."""
    row = s.get(Capability, lid)
    ids = ([r.id for r in s.exec(select(Capability).where(Capability.level == 3)) if r.data.get("parent") == lid]
           if row is not None and row.level == 2 else [lid])
    n = 0
    for i in ids:
        sv = s.get(Survey, i)
        if sv and sv.data.get("status") == "draft" and not sv.data.get("finalised"):
            _log(sv, "finalised", discovery.REPLY_TO, f"{len(sv.data.get('questions', []))} questions", finalised=True)
            s.add(sv)
            n += 1
    if not n and row is not None and row.level != 2:
        _survey(s, lid)
    s.commit()
    return dict(views.business(s), finalised=n)


@router.get("/discovery/{lid}/email")
def email(lid: str, kind: Literal["initial", "explain", "redirect"] = "initial", s: Session = Depends(get_session)):
    row = _l3(s, lid)
    sv = _survey(s, lid)
    l2 = s.get(Capability, row.data["parent"])
    l1 = s.get(Capability, l2.data["parent"])
    return discovery.email_draft(dict(row.data, id=row.id), dict(l2.data, id=l2.id), dict(l1.data, id=l1.id), sv.data, kind)


@router.post("/discovery/{lid}/send")
def send(lid: str, body: SendIn, s: Session = Depends(get_session)):
    """Orchestrate: record that the survey email went out (the POC does not send mail)."""
    sv = _survey(s, lid)
    if sv.data.get("status") == "draft" and not sv.data.get("finalised", True):
        raise HTTPException(409, "Review and finalise the questionnaire before orchestrating it")
    rec = {**(sv.data.get("recipient") or {}), **({"role": body.to_role} if body.to_role else {}), "email": body.to}
    note = {"initial": "Survey sent", "explain": "Resent with explanations", "redirect": "Sent to redirected owner"}[body.kind]
    _log(sv, "sent", discovery.REPLY_TO, f"{note} to {rec.get('role') or 'owner'}{' <' + body.to + '>' if body.to else ''}",
         status="sent", recipient=rec, outcome=None)
    s.add(sv)
    s.commit()
    return views.business(s)


@router.post("/discovery/{lid}/response")
def response(lid: str, body: ResponseIn, s: Session = Depends(get_session)):
    """Owner's reply (email) or the consultant's workshop capture. 'submitted' must answer every scored question."""
    sv = _survey(s, lid)
    if body.outcome == "submitted":
        need = [q["id"] for q in sv.data.get("questions", []) if q.get("dim")]
        missing = [q for q in need if not isinstance(body.answers.get(q), int) or not 1 <= body.answers[q] <= 5]
        if missing:
            raise HTTPException(422, f"Answer every scored question (1-5): {', '.join(missing)}")
    who = body.by or ("Consultant (workshop)" if body.channel == "workshop" else (sv.data.get("recipient") or {}).get("role", "Owner"))
    fields = {"status": {"submitted": "responded", "redirected": "redirected", "walkthrough": "walkthrough"}[body.outcome],
              "outcome": body.outcome, "channel": body.channel, "note": body.note}
    if body.outcome == "submitted":
        fields["answers"] = body.answers
    if body.outcome == "redirected":
        fields["redirect_to"] = body.redirect_to or "Owner to confirm"
    _log(sv, "workshop" if body.channel == "workshop" and body.outcome == "submitted" else body.outcome, who, body.note, **fields)
    sv.source = "client"
    s.add(sv)
    s.commit()
    return views.business(s)


@router.delete("/discovery/{lid}")
def delete_survey(lid: str, s: Session = Depends(get_session)):
    sv = _survey(s, lid)
    s.delete(sv)
    s.commit()
    return views.business(s)


@router.post("/discovery/l2/{cid}/analyse")
def analyse(cid: str, s: Session = Depends(get_session)):
    """Infer the L2 P/T/D/I/importance from its submitted L3 responses and make it the L2 assessment."""
    row = s.get(Capability, cid)
    if row is None or row.level != 2:
        raise HTTPException(404, "Unknown capability")
    state = load_state(s)
    l3 = [dict(r.data, id=r.id) for r in s.exec(select(Capability).where(Capability.level == 3)) if r.data.get("parent") == cid]
    inf = rules.infer_l2(dict(row.data, id=cid), l3, state["surveys"], state["cfg"])
    if not inf["ready"]:
        raise HTTPException(409, "No submitted L3 responses to analyse")
    srcs = {state["surveys"][x]["source"] for x in [i["id"] for i in inf["dims"][0]["inputs"]]}
    prev = row.data.get("discovery") or {}
    row.data = {**row.data, "q": inf["q"], "importance": inf["importance"],
                "discovery": {**prev, "analysed_at": _now(), "by": discovery.REPLY_TO, "comments": prev.get("comments", {})}}
    row.score_source = "client" if "client" in srcs else "assumed"
    s.add(row)
    s.commit()
    return views.business(s)


@router.put("/discovery/l2/{cid}/comments")
def put_comments(cid: str, body: CommentsIn, s: Session = Depends(get_session)):
    row = s.get(Capability, cid)
    if row is None or row.level != 2:
        raise HTTPException(404, "Unknown capability")
    prev = row.data.get("discovery") or {}
    row.data = {**row.data, "discovery": {**prev, "comments": {k: v for k, v in body.comments.items() if v.strip()}}}
    s.add(row)
    s.commit()
    return views.business(s)


# --------------------------------------------------------------------------- gap register (consultant edits)
class GapNoteIn(BaseModel):
    description: str | None = None
    hypothesis: str | None = None
    severity: Literal["High", "Medium", "Low"] | None = None


@router.put("/gaps/{gid}")
def put_gap(gid: str, body: GapNoteIn, s: Session = Depends(get_session)):
    """Edit a generated gap's description, target-state hypothesis or severity (kept as an overlay on the rule output)."""
    if not gid.startswith(("TG-", "TH-")):
        raise HTTPException(404, "Unknown gap")
    ov = s.get(SettingOverride, "gap_notes") or SettingOverride(key="gap_notes", value={})
    cur = dict(ov.value.get(gid, {}))
    cur.update({k: v.strip() for k, v in body.model_dump().items() if isinstance(v, str) and v.strip()})
    ov.value = {**ov.value, gid: cur}
    s.add(ov)
    s.commit()
    return views.business(s)


@router.delete("/gaps/{gid}")
def reset_gap(gid: str, s: Session = Depends(get_session)):
    """Drop the consultant edits so the gap shows the text generated from the answers again."""
    ov = s.get(SettingOverride, "gap_notes")
    if ov and gid in ov.value:
        ov.value = {k: v for k, v in ov.value.items() if k != gid}
        s.add(ov)
        s.commit()
    return views.business(s)


# --------------------------------------------------------------------------- architecture views (process models)
class ModelIn(BaseModel):
    lanes: list[dict]
    nodes: list[dict]
    edges: list[dict]
    name: str | None = None
    description: str | None = None


class NewModelIn(BaseModel):
    name: str = Field(min_length=3)
    description: str = ""
    lanes: list[str] = Field(default_factory=list)
    copy_from: str | None = None


@router.post("/models")
def add_model(body: NewModelIn, s: Session = Depends(get_session)):
    """A new architecture view: blank swimlanes with a starter event and function, or a copy of an existing model."""
    rows = list(s.exec(select(ProcessModel)))
    n = max([int(m.id.split("-")[1]) for m in rows if m.id.split("-")[-1].isdigit()] or [0]) + 1
    mid = f"PM-{n:02d}"
    lane_h = 132
    if body.copy_from:
        src = s.get(ProcessModel, body.copy_from)
        if src is None:
            raise HTTPException(404, "Unknown process model to copy")
        data = copy.deepcopy(src.data)
    else:
        names = [x.strip() for x in body.lanes if x.strip()] or ["Business owner", "Operations", "Systems"]
        lanes = [{"id": x, "name": x} for x in dict.fromkeys(names)]
        y = lambda h: (lane_h - h) / 2  # noqa: E731 - centre a shape in the first lane
        data = {"lanes": lanes, "lane_h": lane_h,
                "nodes": [{"id": "ev1", "type": "event", "label": "Trigger event", "lane": lanes[0]["id"], "x": 40, "y": y(50), "w": 132, "h": 50},
                          {"id": "f1", "type": "function", "label": "First process step", "lane": lanes[0]["id"], "x": 216, "y": y(58), "w": 136, "h": 58}],
                "edges": [{"id": "e1", "from": "ev1", "to": "f1"}]}
    data.update({"id": mid, "name": body.name.strip(), "description": body.description.strip() or data.get("description", ""),
                 "notation": "EPC (swimlane)", "version": 1, "custom": True, "updated": _now()})
    s.add(ProcessModel(id=mid, data=data, source="client"))
    s.commit()
    return dict(views.business(s), added=[mid])


@router.delete("/models/{mid}")
def delete_model(mid: str, s: Session = Depends(get_session)):
    m = s.get(ProcessModel, mid)
    if m is None:
        raise HTTPException(404, "Unknown process model")
    s.delete(m)
    s.commit()
    return dict(views.business(s), deleted=[mid])


@router.put("/models/{mid}")
def put_model(mid: str, body: ModelIn, s: Session = Depends(get_session)):
    m = s.get(ProcessModel, mid)
    if m is None:
        raise HTTPException(404, "Unknown process model")
    ids = {n["id"] for n in body.nodes}
    if any(e.get("from") not in ids or e.get("to") not in ids for e in body.edges):
        raise HTTPException(422, "Every connector must join two shapes")
    m.data = {**m.data, "lanes": body.lanes, "nodes": body.nodes, "edges": body.edges,
              **({"name": body.name} if body.name else {}),
              **({"description": body.description} if body.description is not None else {}), "version": m.data.get("version", 1) + 1, "updated": _now()}
    m.source = "client"
    s.add(m)
    s.commit()
    return views.business(s)


@router.post("/models/{mid}/reset")
def reset_model(mid: str, s: Session = Depends(get_session)):
    seed = next((m for m in read_seed()["process_models"] if m["id"] == mid), None)
    m = s.get(ProcessModel, mid)
    if seed is None or m is None:
        raise HTTPException(404, "Unknown process model")
    m.data, m.source = copy.deepcopy(seed), seed.get("source", "assumed")
    s.add(m)
    s.commit()
    return views.business(s)


@router.put("/capabilities/{cid}")
def put_capability(cid: str, body: CapabilityIn, s: Session = Depends(get_session)):
    row = s.get(Capability, cid)
    if row is None or row.level != 2:
        raise HTTPException(404, "Unknown capability")
    if any(not 1 <= v <= 5 for v in body.q):
        raise HTTPException(422, "Scores must be 1-5")
    data = {**row.data, "q": body.q, "importance": body.importance}
    for k in ("automation", "owner"):
        if getattr(body, k) is not None:
            data[k] = getattr(body, k)
    row.data, row.score_source = data, "client"
    s.add(row)
    if body.apps is not None:
        want = set(body.apps)
        for a in s.exec(select(Application)):
            has = cid in a.data.get("caps", [])
            if (a.id in want) != has:
                caps = [c for c in a.data.get("caps", []) if c != cid] + ([cid] if a.id in want else [])
                a.data, a.source = {**a.data, "caps": caps}, "client"
                s.add(a)
    s.commit()
    return views.business(s)


@router.post("/catalog")
def add_node(body: NodeIn, s: Session = Depends(get_session)):
    if body.level == 0:
        _add(s, 0, None, body.name, description=body.description, owner=body.owner, ref=body.ref)
    else:
        _add(s, body.level, body.parent, body.name, description=body.description, owner=body.owner, ref=body.ref)
    s.commit()
    return views.business(s)


@router.post("/catalog/from_reference")
def add_from_reference(body: FromRefIn, s: Session = Depends(get_session)):
    """Adopt a standard-practice L1, L2 or L3 into the CIL catalog (with everything under it; missing parents are created)."""
    ref = {n["id"]: n for n in read_seed()["reference"]}
    node = ref.get(body.ref)
    if node is None or node["level"] == 0:
        raise HTTPException(404, "Pick a standard L1, L2 or L3")
    rows = list(s.exec(select(Capability)))
    by_ref = {r.data.get("ref"): r for r in rows if r.data.get("ref")}
    added = []

    def ensure(rid: str) -> Capability:
        if rid in by_ref:
            return by_ref[rid]
        n = ref[rid]
        parent = None if n["level"] == 0 else ensure(n["parent"]).id
        extra = {"description": n.get("description", ""), "owner": ""}
        if n["level"] == 2:
            extra["automation"] = ""
        if n["level"] >= 2 and body.parent and rid == body.ref and n["level"] == 2:
            parent = body.parent
        row = _add(s, n["level"], parent, n["name"], ref=rid, **extra)
        if n["level"] == 3:
            row.data = {**row.data, "owner": s.get(Capability, parent).data.get("owner", "")}
        s.flush()
        by_ref[rid] = row
        if n["level"] >= 2:
            added.append(row.id)
        return row

    ensure(node["id"])
    for lvl in (2, 3):  # everything under the picked node
        for n in [x for x in ref.values() if x["level"] == lvl]:
            anc, p = [], n["parent"]
            while p:
                anc.append(p)
                p = ref[p]["parent"]
            if node["id"] in anc:
                ensure(n["id"])
    s.commit()
    out = views.business(s)
    out["added"] = added
    return out

@router.put("/catalog/{cid}")
def edit_node(cid: str, body: NodePatch, s: Session = Depends(get_session)):
    row = s.get(Capability, cid)
    if row is None:
        raise HTTPException(404, "Unknown capability")
    bad = set(body.fields) - NODE_FIELDS
    if bad:
        raise HTTPException(422, f"Not editable: {', '.join(sorted(bad))}")
    if "parent" in body.fields and row.level > 0:
        p = s.get(Capability, body.fields["parent"] or "")
        if p is None or p.level != row.level - 1:
            raise HTTPException(422, "Parent must be one level up")
        if row.level == 1:
            body.fields["l0"] = body.fields["parent"]
    row.data = {**row.data, **body.fields}
    row.source = "client"
    s.add(row)
    s.commit()
    return views.business(s)


@router.delete("/catalog/{cid}")
def delete_node(cid: str, s: Session = Depends(get_session)):
    row = s.get(Capability, cid)
    if row is None:
        raise HTTPException(404, "Unknown capability")
    rows = list(s.exec(select(Capability)))
    doomed = {cid}
    for _ in range(3):
        doomed |= {r.id for r in rows if r.data.get("parent") in doomed}
    for sv in s.exec(select(Survey)):
        if sv.id in doomed:
            s.delete(sv)
    for r in rows:
        if r.id in doomed:
            s.delete(r)
        elif r.level == 2 and set(r.data.get("depends_on", [])) & doomed:
            r.data = {**r.data, "depends_on": [d for d in r.data["depends_on"] if d not in doomed]}
            s.add(r)
    for a in s.exec(select(Application)):
        if set(a.data.get("caps", [])) & doomed:
            a.data = {**a.data, "caps": [c for c in a.data["caps"] if c not in doomed]}
            s.add(a)
    s.commit()
    out = views.business(s)
    out["deleted"] = sorted(doomed, key=nat_key)
    return out
