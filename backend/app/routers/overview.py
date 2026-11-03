from fastapi import APIRouter, Depends
from sqlmodel import Session

from .. import views
from ..db import get_session

router = APIRouter(prefix="/api", tags=["overview"])


@router.get("/overview")
def get_overview(s: Session = Depends(get_session)):
    return views.overview(s)
