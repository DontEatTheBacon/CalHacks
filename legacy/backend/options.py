"""Searchable option lists for the profile form: schools, countries, majors and start terms.

Schools and countries come from the open world university list (https://github.com/Hipo/university-domains-list),
downloaded once and cached on disk so later runs work offline.
"""

import json
import logging
import re
from datetime import date
from functools import cache
from pathlib import Path

import httpx

log = logging.getLogger(__name__)

UNIVERSITIES_URL = "https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json"
CACHE_FILE = Path(__file__).parent / ".cache" / "universities.json"

SEASONS = ["Spring", "Summer", "Fall", "Winter"]
YEARS_AHEAD = 5

MAJORS = sorted([
    "Accounting", "Aerospace Engineering", "Agriculture", "Anthropology", "Architecture", "Art and Design",
    "Biochemistry", "Bioengineering", "Biology", "Biomedical Engineering", "Business Administration",
    "Chemical Engineering", "Chemistry", "Civil Engineering", "Communications", "Computer Engineering",
    "Computer Science", "Cybersecurity", "Data Science", "Dentistry", "Economics", "Education",
    "Electrical Engineering", "English", "Environmental Science", "Film and Media", "Finance", "Fine Arts",
    "Geology", "Graphic Design", "Health Sciences", "History", "Hospitality Management", "Industrial Engineering",
    "Information Systems", "International Relations", "Journalism", "Law", "Linguistics", "Management",
    "Marketing", "Materials Science", "Mathematics", "Mechanical Engineering", "Medicine", "Music",
    "Neuroscience", "Nursing", "Pharmacy", "Philosophy", "Physics", "Political Science", "Psychology",
    "Public Health", "Public Policy", "Sociology", "Software Engineering", "Statistics",
    "Supply Chain Management", "Urban Planning",
])


@cache
def universities() -> list[dict]:
    """Every university in the open list, downloaded once and cached on disk."""
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    log.info("Downloading the world university list")
    response = httpx.get(UNIVERSITIES_URL, timeout=30, follow_redirects=True)
    response.raise_for_status()
    data = response.json()
    CACHE_FILE.parent.mkdir(exist_ok=True)
    CACHE_FILE.write_text(json.dumps(data), encoding="utf-8")
    return data


def _words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9&]+", text.lower())


SMALL_WORDS = {"of", "the", "and", "at", "for", "in", "de"}


def _initials(words: list[str]) -> str:
    """'Massachusetts Institute of Technology' -> 'mit'."""
    return "".join(word[0] for word in words if word not in SMALL_WORDS)


def search(names: list[str], query: str, limit: int) -> list[str]:
    """Names containing every word of the query, or whose initials match it ('mit'), best matches first."""
    words = _words(query)
    if not words:
        return names[:limit]
    wanted = " ".join(words)
    matches = []
    for name in names:
        name_words = _words(name)
        normal = " ".join(name_words)
        if all(word in normal for word in words):
            rank = 0 if normal == wanted else 1 if normal.startswith(wanted) else 2 if f" {wanted}" in f" {normal}" else 3
        elif len(words) == 1 and len(wanted) > 1 and _initials(name_words) == wanted:
            rank = 0  # an acronym like 'mit' or 'ucla'
        else:
            continue
        # Names whose words all start with the query's words ('georgia tech' -> Georgia Institute of Technology) next.
        if rank == 3 and all(any(w.startswith(word) for w in name_words) for word in words):
            rank = 2
        matches.append((rank, len(name), name))
    return [name for _, _, name in sorted(matches)[:limit]]


def schools(query: str = "", country: str | None = None, limit: int = 20) -> list[dict]:
    by_name: dict[str, dict] = {}
    for university in universities():
        if country and university["country"].lower() != country.lower():
            continue
        by_name.setdefault(university["name"], university)  # the list has a few duplicate names
    found = search(sorted(by_name), query, limit)
    return [
        {
            "name": name,
            "country": by_name[name]["country"],
            "website": (by_name[name]["web_pages"] or [None])[0],
            "domains": by_name[name]["domains"],
        }
        for name in found
    ]


def countries(query: str = "") -> list[str]:
    return search(sorted({university["country"] for university in universities()}), query, limit=300)


def majors(query: str = "") -> list[str]:
    return search(MAJORS, query, limit=len(MAJORS))


def terms() -> dict:
    """Seasons and the years a student could start in, from this year on."""
    year = date.today().year
    return {"seasons": SEASONS, "years": list(range(year, year + YEARS_AHEAD + 1))}
