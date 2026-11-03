"""Login gate for hosted demos: named users from APP_USERS, a signed HttpOnly session cookie, no user table.
Off when APP_USERS is empty (local development)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from .config import get_settings

COOKIE = "ea_session"
OPEN = ("/api/health", "/api/auth/")

router = APIRouter(prefix="/api/auth", tags=["auth"])


def users() -> dict[str, str]:
    """APP_USERS = "name:password,name2:password2" (usernames are case-insensitive)."""
    out = {}
    for pair in get_settings().app_users.split(","):
        name, sep, pw = pair.strip().partition(":")
        if sep and name.strip() and pw:
            out[name.strip().lower()] = pw
    return out


def enabled() -> bool:
    return bool(users())


def _key() -> bytes:
    s = get_settings()
    # Without SESSION_SECRET the key derives from the user list, so changing a password signs everyone out.
    return (s.session_secret or hashlib.sha256(s.app_users.encode()).hexdigest()).encode()


def _sign(msg: str) -> str:
    return base64.urlsafe_b64encode(hmac.new(_key(), msg.encode(), hashlib.sha256).digest()).decode().rstrip("=")


def make_token(user: str) -> str:
    msg = f"{user}|{int(time.time()) + get_settings().session_hours * 3600}"
    return f"{msg}|{_sign(msg)}"


def user_of(token: str | None) -> str | None:
    if not token or token.count("|") != 2:
        return None
    user, exp, sig = token.split("|")
    if not hmac.compare_digest(sig, _sign(f"{user}|{exp}")) or not exp.isdigit() or int(exp) < time.time():
        return None
    return user if user in users() else None


def needs_login(request: Request) -> bool:
    p = request.url.path
    return enabled() and p.startswith("/api/") and not p.startswith(OPEN) and not user_of(request.cookies.get(COOKIE))


class LoginIn(BaseModel):
    username: str
    password: str


@router.get("/me")
def me(request: Request):
    return {"required": enabled(), "user": user_of(request.cookies.get(COOKIE)) if enabled() else None}


@router.post("/login")
def login(body: LoginIn, request: Request, response: Response):
    name = body.username.strip().lower()
    pw = users().get(name)
    if pw is None or not secrets.compare_digest(body.password.encode(), pw.encode()):
        time.sleep(0.5)  # slow down guessing
        raise HTTPException(401, "Incorrect username or password")
    https = request.headers.get("x-forwarded-proto", request.url.scheme) == "https"
    response.set_cookie(COOKIE, make_token(name), max_age=get_settings().session_hours * 3600, httponly=True,
                        samesite="lax", secure=https)
    return {"required": True, "user": name}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE)
    return {"required": enabled(), "user": None}
