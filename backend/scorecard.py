"""US Department of Education College Scorecard lookups: https://collegescorecard.ed.gov/data/api/"""

import os

import httpx

URL = "https://api.data.gov/ed/collegescorecard/v1/schools"
FIELDS = [
    "id",
    "school.name",
    "latest.student.size",
    "latest.cost.tuition.out_of_state",
    "latest.cost.roomboard.oncampus",
    "latest.cost.otherexpense.oncampus",
    "latest.cost.booksupply",
]


def find_school(name: str) -> dict | None:
    """Best Scorecard match for a college name, or None (e.g. schools outside the US)."""
    response = httpx.get(
        URL,
        params={
            # DEMO_KEY works but is heavily rate limited; get a free key at https://api.data.gov/signup/
            "api_key": os.getenv("SCORECARD_API_KEY", "DEMO_KEY"),
            "school.name": name,
            "fields": ",".join(FIELDS),
            "per_page": 20,
        },
        timeout=10,
    )
    response.raise_for_status()
    results = response.json()["results"]
    if not results:
        return None

    # The API ignores sorting, so prefer an exact name, then the main campus, then the largest school.
    def rank(school: dict) -> tuple:
        school_name = school["school.name"].lower()
        return (
            school_name == name.lower(),
            school_name.endswith("-main campus"),
            school["latest.student.size"] or 0,
        )

    return max(results, key=rank)


def page_url(school: dict) -> str:
    """The school's public College Scorecard page."""
    return f"https://collegescorecard.ed.gov/school/?{school['id']}"


def living_cost(school: dict) -> int | None:
    """Yearly on-campus room and board, other expenses, and books."""
    parts = [school[f"latest.cost.{field}"] for field in ("roomboard.oncampus", "otherexpense.oncampus", "booksupply")]
    return sum(parts) if all(part is not None for part in parts) else None
