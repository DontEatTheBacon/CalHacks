from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel

load_dotenv()

from agent import run_agent  # noqa: E402

app = FastAPI()

class Profile(BaseModel):
    budget: str
    major: str
    from_country: str
    gpa: str
    college: str
    college_location: str

@app.post("/api/plan")
def plan(profile: Profile):
    return run_agent(profile.model_dump())
