from typing import Any, Literal

from sqlmodel import Field, SQLModel


class Profile(SQLModel):
    gpa: str
    from_school: str
    from_location: str


class GpaConversion(SQLModel):
    converted_gpa: float = Field(description="The GPA on the US 4.0 scale")

class Step(SQLModel):
    title: str
    category: str
    description: str
    deadline: str | None = None


class Plan(SQLModel):
    school: str
    steps: list[Step]


# Events streamed from /api/plan/stream, one JSON object per line.
class ToolCallEvent(SQLModel):
    type: Literal["tool_call"] = "tool_call"
    name: str
    args: dict[str, Any]


class ToolResultEvent(SQLModel):
    type: Literal["tool_result"] = "tool_result"
    name: str
    result: dict[str, Any]


class PlanEvent(SQLModel):
    type: Literal["plan"] = "plan"
    plan: Plan


class ErrorEvent(SQLModel):
    type: Literal["error"] = "error"
    detail: str
