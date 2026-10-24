from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from google.genai import errors
from pydantic import ValidationError

load_dotenv()

from agent import agent_events, run_agent  # noqa: E402
from models import ErrorEvent, Plan, Profile  # noqa: E402

app = FastAPI()

@app.post("/api/plan", response_model=Plan)
def plan(profile: Profile):
    try:
        return run_agent(profile.model_dump())
    except (ValidationError, RuntimeError) as e:
        raise HTTPException(status_code=502, detail=f"Agent returned an invalid plan: {e}")
    except errors.APIError as e:
        raise HTTPException(status_code=503, detail=f"Gemini error: {e}")


@app.post("/api/plan/stream")
def plan_stream(profile: Profile):
    # Streams agent events as newline-delimited JSON so the UI can show tool use live.
    def events():
        try:
            for event in agent_events(profile.model_dump()):
                yield event.model_dump_json() + "\n"
        except (ValidationError, RuntimeError) as e:
            yield ErrorEvent(detail=f"Agent returned an invalid plan: {e}").model_dump_json() + "\n"
        except errors.APIError as e:
            yield ErrorEvent(detail=f"Gemini error: {e}").model_dump_json() + "\n"
        except Exception as e:
            # Headers are already sent mid-stream, so report anything else as an event too.
            yield ErrorEvent(detail=f"Agent failed: {e!r}").model_dump_json() + "\n"

    return StreamingResponse(events(), media_type="application/x-ndjson")
