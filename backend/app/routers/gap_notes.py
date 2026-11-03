"""Shared overlay for consultant edits to generated gaps (description, hypothesis, severity)."""
from typing import Literal

from pydantic import BaseModel, Field
from sqlmodel import Session

from ..models import SettingOverride


class GapNoteIn(BaseModel):
    description: str | None = Field(None, max_length=2000)
    hypothesis: str | None = Field(None, max_length=2000)
    severity: Literal["High", "Medium", "Low"] | None = None


def put_note(s: Session, key: str, gid: str, body: GapNoteIn) -> None:
    ov = s.get(SettingOverride, key) or SettingOverride(key=key, value={})
    cur = dict(ov.value.get(gid, {}))
    cur.update({k: v.strip() for k, v in body.model_dump().items() if isinstance(v, str) and v.strip()})
    ov.value = {**ov.value, gid: cur}
    s.add(ov)
    s.commit()


def drop_note(s: Session, key: str, gid: str) -> None:
    ov = s.get(SettingOverride, key)
    if ov and gid in ov.value:
        ov.value = {k: v for k, v in ov.value.items() if k != gid}
        s.add(ov)
        s.commit()
