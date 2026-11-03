"""Shared helpers for screen routers."""
from __future__ import annotations

from fastapi import HTTPException

from ..rag.profiles import SCREENS


def check_screen(screen: str) -> str:
    if screen not in SCREENS:
        raise HTTPException(404, f"Unknown screen '{screen}'")
    return screen
