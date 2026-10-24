import os
from types import SimpleNamespace

from dotenv import load_dotenv

load_dotenv()  # real keys, only used by live tests
os.environ.setdefault("GEMINI_API_KEY", "test-key")  # agent.py needs a key to import

import httpx  # noqa: E402
import pytest  # noqa: E402

import agent  # noqa: E402

LIVE = os.getenv("RUN_LIVE") == "1"


def pytest_collection_modifyitems(config, items):
    if LIVE:
        return
    skip = pytest.mark.skip(reason="set RUN_LIVE=1 to call the real APIs")
    for item in items:
        if "live" in item.keywords:
            item.add_marker(skip)


@pytest.fixture(autouse=True)
def no_network(request, monkeypatch):
    """Non-live tests fail loudly if they reach Gemini or Scorecard."""
    if request.node.get_closest_marker("live"):
        return

    def blocked(*args, **kwargs):
        raise AssertionError("test tried to use the network")

    monkeypatch.setattr(agent.client.models, "generate_content", blocked)
    monkeypatch.setattr(httpx, "get", blocked)
    monkeypatch.setattr(httpx, "post", blocked)
    monkeypatch.setattr(agent, "_resume_at", 0.0)  # no 429 cooldown carried between tests


@pytest.fixture
def scripted_gemini(monkeypatch):
    """Replaces agent.generate with a script of responses (or exceptions); records each call's kwargs."""
    gemini = SimpleNamespace(script=[], sent=[])

    def fake_generate(**kwargs):
        gemini.sent.append(kwargs)
        item = gemini.script.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    monkeypatch.setattr(agent, "generate", fake_generate)
    return gemini
