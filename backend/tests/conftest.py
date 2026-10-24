import os
from types import SimpleNamespace

from dotenv import load_dotenv

load_dotenv()  # real keys, only used by live tests
os.environ.setdefault("CLAUDE_KEY", "test-key")  # agent.py needs a key to import

import httpx  # noqa: E402
import pytest  # noqa: E402

import agent  # noqa: E402
import open_data  # noqa: E402

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
    """Non-live tests fail loudly if they reach Claude, Scorecard or the open-data APIs."""
    if request.node.get_closest_marker("live"):
        return

    def blocked(*args, **kwargs):
        raise AssertionError("test tried to use the network")

    monkeypatch.setattr(agent.client.messages, "create", blocked)
    monkeypatch.setattr(agent.client.messages, "parse", blocked)
    monkeypatch.setattr(agent.client.beta.messages, "create", blocked)
    monkeypatch.setattr(httpx, "get", blocked)
    monkeypatch.setattr(httpx, "post", blocked)
    monkeypatch.setattr(agent, "_resume_at", 0.0)  # no 429 cooldown carried between tests
    monkeypatch.setattr(open_data, "find_university", lambda name: None)  # no university lookups unless a test sets one


@pytest.fixture
def scripted_claude(monkeypatch):
    """Replaces agent.generate and agent.generate_structured with one script of responses (or exceptions).

    Records each call's kwargs; structured calls also record the schema under "schema".
    """
    claude = SimpleNamespace(script=[], sent=[])

    def next_response(kwargs):
        claude.sent.append(kwargs)
        item = claude.script.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    monkeypatch.setattr(agent, "generate", lambda **kwargs: next_response(kwargs))
    monkeypatch.setattr(agent, "generate_structured", lambda schema, **kwargs: next_response({**kwargs, "schema": schema}))
    return claude
