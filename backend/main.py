import logging
import os

import anthropic
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import ValidationError

load_dotenv()
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

import options  # noqa: E402
from agent import agent_events, redo_step, run_agent  # noqa: E402
from models import ErrorEvent, Plans, Profile, SchoolOption, StepRedoRequest, StepRedoResult, TermOptions  # noqa: E402

log = logging.getLogger(__name__)
app = FastAPI()


def describe_failure(e: Exception) -> tuple[int, str]:
    """HTTP status and message for an agent run that failed."""
    if isinstance(e, (TimeoutError, httpx.TimeoutException, anthropic.APITimeoutError)):
        return 504, f"The agent took too long: {e}"
    if isinstance(e, (anthropic.APIStatusError, anthropic.APIConnectionError)):
        return 503, f"Claude error: {e}"
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


@app.post("/api/steps/redo", response_model=StepRedoResult)
def redo(request: StepRedoRequest):
    """Replaces one step the student didn't like with a different suggestion."""
    try:
        return StepRedoResult(step=redo_step(request.profile.model_dump(), request.school, request.rejected, request.feedback))
    except Exception as e:
        log.exception("Step redo failed")
        status, detail = describe_failure(e)
        raise HTTPException(status_code=status, detail=detail)


# Searchable option lists for the profile form.
def _with_university_list(lookup):
    try:
        return lookup()
    except httpx.HTTPError as e:
        log.exception("World university list unavailable")
        raise HTTPException(status_code=503, detail=f"The university list is unavailable: {e}")


@app.get("/api/options/schools", response_model=list[SchoolOption])
def school_options(q: str = "", country: str | None = None, limit: int = Query(20, ge=1, le=100)):
    return _with_university_list(lambda: options.schools(q, country, limit))


@app.get("/api/options/countries", response_model=list[str])
def country_options(q: str = ""):
    return _with_university_list(lambda: options.countries(q))


@app.get("/api/options/majors", response_model=list[str])
def major_options(q: str = ""):
    return options.majors(q)


@app.get("/api/options/terms", response_model=TermOptions)
def term_options():
    return options.terms()
