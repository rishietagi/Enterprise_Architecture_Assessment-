from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_fallback_model: str = "gemini-2.5-flash-lite"
    llm_rpm: int = 8

    seed_dir: Path = ROOT_DIR / "seed"
    togaf_dir: Path = ROOT_DIR / "data" / "togaf"
    index_dir: Path = ROOT_DIR / "data" / "index"
    model_cache_dir: Path = ROOT_DIR / "data" / "models"
    db_path: Path = ROOT_DIR / "data" / "cil.db"

    embed_model: str = "BAAI/bge-small-en-v1.5"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def course_pdf(self) -> Path:
        return self.togaf_dir / "TOGAF_9.1.pdf"

    @property
    def guide_pdf(self) -> Path:
        return self.togaf_dir / "TOGAF_Study_Guide.pdf"

    @property
    def has_key(self) -> bool:
        return bool(self.gemini_api_key.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
