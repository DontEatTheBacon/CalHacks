"""Calls the real APIs; run with RUN_LIVE=1 (uses Claude credits and the Scorecard DEMO_KEY)."""

import pytest

import agent
from samples import TOOL_ARGS

pytestmark = pytest.mark.live


@pytest.mark.parametrize("name", list(agent.TOOLS))
def test_tool_returns_a_valid_result(name):
    result = agent.run_tool(name, TOOL_ARGS[name])
    assert "error" not in result, result
    agent.TOOLS[name].result.model_validate(result)
