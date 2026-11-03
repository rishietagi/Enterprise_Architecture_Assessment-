import os
import tempfile
from pathlib import Path

# Isolate tests: temp DB and no Gemini key (deterministic fallback path), set before the app is imported.
_tmp = Path(tempfile.mkdtemp(prefix="cil-test-"))
os.environ["DB_PATH"] = str(_tmp / "test.db")
os.environ["GEMINI_API_KEY"] = ""
os.environ["APP_USERS"] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def client():
    from app.main import app

    with TestClient(app) as c:
        yield c
