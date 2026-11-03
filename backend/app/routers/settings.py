import threading
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session

from ..db import deep_merge, effective_config, get_session, read_seed, reset_demo
from ..llm import gemini
from ..models import SettingOverride
from ..rag import retrieve
from ..rag.ingest import ingest

router = APIRouter(prefix="/api/settings", tags=["settings"])
_reindex = {"running": False, "last": None}


class ConfigPatch(BaseModel):
    patch: dict[str, Any]


def _editable(cfg: dict) -> dict:
    """The rule parameters surfaced in the Settings sheet."""
    c, d = cfg["capability_rules"], cfg["data_rules"]
    return {"capability_rules": {k: c.get(k) for k in ("gap_importance_min", "gap_maturity_max", "critical_maturity_max")},
            "rationalization": {"threshold": cfg["rationalization"]["threshold"]},
            "data_rules": {"score_weights": d["score_weights"], "gap_score_below": d.get("gap_score_below", 60),
                           "ai_ready_min": d.get("ai_ready_min", 60)},
            "roadmap": {"rate_card_inr_cr": cfg["roadmap"]["rate_card_inr_cr"]}}


def payload(s: Session) -> dict:
    return {"config": _editable(effective_config(s)), "defaults": _editable(read_seed()["cfg"]),
            "rag": {**retrieve.status(), "reindex": _reindex}, "llm": gemini.status()}


@router.get("")
def get_settings_view(s: Session = Depends(get_session)):
    return payload(s)


@router.put("/config")
def put_config(body: ConfigPatch, s: Session = Depends(get_session)):
    allowed = _editable(read_seed()["cfg"])
    clean = {k: v for k, v in body.patch.items() if k in allowed}
    ov = s.get(SettingOverride, "config") or SettingOverride(key="config", value={})
    ov.value = deep_merge(ov.value, clean)
    s.add(ov)
    s.commit()
    return payload(s)


@router.post("/reset")
def reset(s: Session = Depends(get_session)):
    reset_demo(s)
    return payload(s)


def _run_reindex():
    try:
        _reindex["last"] = ingest(force=True)
        retrieve.INDEX.load()
        retrieve.INDEX.model = None
        threading.Thread(target=retrieve.INDEX.warm_model, daemon=True).start()
    except Exception as e:  # surfaced in Settings
        _reindex["last"] = {"status": "error", "detail": str(e)}
    finally:
        _reindex["running"] = False


@router.post("/reindex")
def reindex(s: Session = Depends(get_session)):
    if not _reindex["running"]:
        _reindex["running"] = True
        threading.Thread(target=_run_reindex, daemon=True).start()
    return payload(s)
