from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlmodel import Session

from ..db import get_session
from ..llm import calls
from .screens import check_screen

router = APIRouter(prefix="/api", tags=["coach"])


class AskIn(BaseModel):
    q: str = Field(min_length=3, max_length=500)
    screen: str | None = None


@router.post("/coach/ask")
def ask(body: AskIn, s: Session = Depends(get_session)):
    return calls.ask(s, body.q, body.screen)


@router.post("/coach/{screen}")
def coach(screen: str, s: Session = Depends(get_session)):
    return calls.coach(s, check_screen(screen))


@router.post("/findings/{screen}")
def findings(screen: str, tab: str | None = None, s: Session = Depends(get_session)):
    """AI insights for a screen, or for one tab of it (?tab=) when the screen publishes per-tab rule insights."""
    return calls.findings(s, check_screen(screen), tab)
