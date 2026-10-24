"""Deterministic date windows for every step, worked out from the start term and any rigid deadlines."""

import re
import typing
from datetime import date, timedelta

import backend.tool_models as tm

MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
SEASONS = {"spring": 1, "winter": 1, "summer": 6, "fall": 8, "autumn": 8}

# Each step's window, in days relative to an anchor: the application deadline or the program start.
# UPDATE LATER: these lead times are US F-1 defaults; other countries need their own.
RULES: dict[str, tuple[str, int, int]] = {
    "gpa": ("application", -90, -60),
    "test": ("application", -90, -45),
    "transfer": ("application", -90, -40),
    "language": ("application", -75, -30),
    "application": ("application", -90, 0),
    "scholarship": ("application", -60, 0),
    "cost": ("application", 30, 60),  # proof of funds for the I-20, once admitted
    "visa": ("start", -120, -60),
    "housing": ("start", -120, -60),
    "insurance": ("start", -60, -30),
    "travel": ("start", -30, -7),  # F-1 students may arrive at most 30 days before classes
    "work": ("start", 0, 60),
}
DEFAULT_APPLICATION_DEADLINE = -180  # days before the program starts, when no deadline was found
ANCHOR_NAMES = {"application": "the application deadline", "start": "the program start"}


def parse_term(term: str) -> date | None:
    """'February 2027' or 'Fall 2027' -> the first day of that month."""
    match = re.fullmatch(r"([a-z]+)\s+(\d{4})", term.strip().lower())
    if not match:
        return None
    word, year = match.groups()
    month = SEASONS.get(word) or (MONTHS.index(word[:3]) + 1 if word[:3] in MONTHS else None)
    return date(int(year), month, 1) if month else None


def _describe(anchor: str, start: int, end: int) -> str:
    def when(days: int) -> str:
        name = ANCHOR_NAMES[anchor]
        return name if days == 0 else f"{abs(days)} days {'before' if days < 0 else 'after'} {name}"

    return f"From {when(start)} to {when(end)}"


def schedule_steps(args: tm.ScheduleArgs) -> tm.Schedule:
    program_start = parse_term(args.start_term)
    if program_start is None:
        raise ValueError(f"can't read the start term {args.start_term!r}; use a month or season and year, e.g. 'February 2027'")

    # Rigid dates win; if a step has several (e.g. scholarships), the earliest deadline counts.
    fixed: dict[str, tm.FixedDate] = {}
    for item in args.fixed_dates:
        if item.step_type not in fixed or item.end_date < fixed[item.step_type].end_date:
            fixed[item.step_type] = item

    application = fixed["application"].end_date if "application" in fixed else program_start + timedelta(days=DEFAULT_APPLICATION_DEADLINE)
    anchors = {"application": application, "start": program_start}
    today = date.today()

    steps = []
    for step_type in typing.get_args(tm.StepType):
        anchor, start_offset, end_offset = RULES[step_type]
        if step_type in fixed:
            item = fixed[step_type]
            start = item.start_date or item.end_date - timedelta(days=end_offset - start_offset)
            steps.append(tm.ScheduledStep(step_type=step_type, start_date=start, end_date=item.end_date, rule="Fixed deadline"))
            continue

        start = anchors[anchor] + timedelta(days=start_offset)
        end = anchors[anchor] + timedelta(days=end_offset)
        rule = _describe(anchor, start_offset, end_offset)
        if end < today:  # the ideal window has passed, so do it now
            start, end = today, today + (end - start)
            rule += "; that window has passed, so starting now"
        steps.append(tm.ScheduledStep(step_type=step_type, start_date=start, end_date=end, rule=rule))

    return tm.Schedule(college=args.college, program_start=program_start, steps=steps)
