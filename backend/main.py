import logging
import os

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from google.genai import errors
from pydantic import ValidationError

load_dotenv()
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

from agent import agent_events, run_agent  # noqa: E402
from models import ErrorEvent, Plans, Profile  # noqa: E402

log = logging.getLogger(__name__)
app = FastAPI()


def describe_failure(e: Exception) -> tuple[int, str]:
    """HTTP status and message for an agent run that failed."""
    if isinstance(e, (TimeoutError, httpx.TimeoutException)):
        return 504, f"The agent took too long: {e}"
    if isinstance(e, errors.APIError):
        return 503, f"Gemini error: {e}"
    if isinstance(e, (ValidationError, RuntimeError)):
        return 502, f"Agent returned an invalid plan: {e}"
    return 500, f"Agent failed: {e!r}"


@app.post("/api/plan", response_model=Plans)
def plan(profile: Profile):
    try:
        return run_agent(profile.model_dump())
    except Exception as e:
        log.exception("Plan request failed")
        status, detail = describe_failure(e)
        raise HTTPException(status_code=status, detail=detail)


@app.post("/api/plan/stream")
def plan_stream(profile: Profile):
    # Streams agent events as newline-delimited JSON so the UI can show tool use live.
    def events():
        try:
            for event in agent_events(profile.model_dump()):
                yield event.model_dump_json() + "\n"
        except Exception as e:
            # Headers are already sent mid-stream, so failures are reported as a final event.
            log.exception("Plan stream failed")
            yield ErrorEvent(detail=describe_failure(e)[1]).model_dump_json() + "\n"

    return StreamingResponse(events(), media_type="application/x-ndjson")
