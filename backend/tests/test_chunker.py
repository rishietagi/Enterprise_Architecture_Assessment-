import collections

import pytest

from app.config import get_settings
from app.rag.chunker import build_chunks
from app.rag.profiles import SCREENS, TAG_ALIAS

s = get_settings()
pytestmark = pytest.mark.skipif(not s.course_pdf.exists(), reason="TOGAF PDFs not in data/togaf/")


@pytest.fixture(scope="module")
def chunks():
    return build_chunks(str(s.course_pdf), str(s.guide_pdf) if s.guide_pdf.exists() else None)


def test_21_principles(chunks):
    principles = [c for c in chunks if c["content_type"] == "principle"]
    assert len(principles) == 21
    assert all(c["subtitle"].startswith("Principle ") for c in principles)


def test_application_portfolio_catalog(chunks):
    text = "\n".join(c["text"] for c in chunks if (c["section_no"] or "").startswith("35.6.5"))
    assert "Application Portfolio Catalog" in text


def test_every_screen_has_50_chunks(chunks):
    by_screen = collections.Counter(sc for c in chunks for sc in c["screens"])
    for screen in SCREENS:
        assert by_screen[TAG_ALIAS.get(screen, screen)] >= 50, screen


def test_ids_unique(chunks):
    assert len({c["id"] for c in chunks}) == len(chunks)
