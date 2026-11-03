"""SQLModel tables. Inputs only - every score, gap, wave and Rs figure is computed on request by app.rules."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Capability(SQLModel, table=True):
    """Catalog node at L0-L3. L2 data holds the assessment (q, importance), inferred from L3 discovery once analysed."""
    id: str = Field(primary_key=True)  # L0-1, C07, C07.1, C07.1.2
    level: int
    data: dict[str, Any] = Field(sa_column=Column(JSON))
    source: str = "assumed"  # catalog entry provenance
    score_source: str = "assumed"  # provenance of the questionnaire answers


class Survey(SQLModel, table=True):
    """Current-state discovery questionnaire for one L3: questions, orchestration history and the owner's response."""
    id: str = Field(primary_key=True)  # L3 id, e.g. C04.1.2
    data: dict[str, Any] = Field(sa_column=Column(JSON))
    source: str = "assumed"


class ProcessModel(SQLModel, table=True):
    """ARIS-style EPC swimlane model (Architecture views): lanes, nodes, edges."""
    id: str = Field(primary_key=True)  # PM-01
    data: dict[str, Any] = Field(sa_column=Column(JSON))
    source: str = "assumed"


class ArchView(SQLModel, table=True):
    """Editable reference architecture view (layers of building blocks, optional cross-cutting column and flows)."""
    id: str = Field(primary_key=True)  # APP-REF, DATA-REF, INFRA-REF
    screen: str
    data: dict[str, Any] = Field(sa_column=Column(JSON))
    source: str = "assumed"


class PlanTask(SQLModel, table=True):
    """Status of an engagement-plan activity (the plan itself is seeded in vision.json)."""
    id: str = Field(primary_key=True)  # BA-03
    status: str
    source: str = "assumed"


class Guideline(SQLModel, table=True):
    """CIL principles, guardrails and architecture patterns (TOGAF principles come from the index)."""
    id: str = Field(primary_key=True)  # P-CIL-01, G-01, PT-01
    kind: str  # principle | guardrail | pattern
    data: dict[str, Any] = Field(sa_column=Column(JSON))
    source: str = "assumed"


class Integration(SQLModel, table=True):
    id: str = Field(primary_key=True)  # I01
    data: dict[str, Any] = Field(sa_column=Column(JSON))
    source: str = "assumed"


class Application(SQLModel, table=True):
    id: str = Field(primary_key=True)
    data: dict[str, Any] = Field(sa_column=Column(JSON))  # full record in seed shape
    source: str = "assumed"


class DataDomain(SQLModel, table=True):
    id: str = Field(primary_key=True)
    data: dict[str, Any] = Field(sa_column=Column(JSON))
    source: str = "assumed"


class Platform(SQLModel, table=True):
    id: str = Field(primary_key=True)
    data: dict[str, Any] = Field(sa_column=Column(JSON))
    source: str = "assumed"


class TechCheck(SQLModel, table=True):
    id: str = Field(primary_key=True)
    status: str
    source: str = "assumed"


class AcmmLevel(SQLModel, table=True):
    id: str = Field(primary_key=True)
    level: int
    source: str = "assumed"


class PrincipleSelection(SQLModel, table=True):
    id: str = Field(primary_key=True)  # P-CIL-01 or TOGAF-01
    adopted: bool = False


class VisionDoc(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)
    vision_statement: str = ""
    ai_ambition: str = ""
    objectives: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    success_measures: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    citations: list[dict] = Field(default_factory=list, sa_column=Column(JSON))
    source: str = "assumed"
    mode: str = ""
    updated: datetime = Field(default_factory=_now)


class ContextDoc(SQLModel, table=True):
    """A document uploaded as context for the Architecture Vision (text extracted on upload)."""
    id: int | None = Field(default=None, primary_key=True)
    name: str
    kind: str = ""  # pdf | docx | xlsx | pptx | txt | md
    size: int = 0
    text: str = ""
    source: str = "client"
    uploaded: datetime = Field(default_factory=_now)


class Decision(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str
    context: str = ""
    decision: str = ""
    principles: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    status: str = "Proposed"
    source: str = "assumed"
    created: datetime = Field(default_factory=_now)


class SettingOverride(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: dict[str, Any] = Field(sa_column=Column(JSON))


class LlmCache(SQLModel, table=True):
    key: str = Field(primary_key=True)  # sha256(model + prompt)
    kind: str
    model: str
    response: dict[str, Any] = Field(sa_column=Column(JSON))
    created: datetime = Field(default_factory=_now)
