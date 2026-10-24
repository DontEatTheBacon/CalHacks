from datetime import date

import httpx
import pytest
from fastapi.testclient import TestClient

import main
import options


def university(name, country, domain):
    return {"name": name, "country": country, "domains": [domain], "web_pages": [f"https://www.{domain}/"]}


UNIVERSITIES = [
    university("Massachusetts Institute of Technology", "United States", "mit.edu"),
    university("Madras Institute of Technology", "India", "mitindia.edu"),
    university("Georgia Institute of Technology", "United States", "gatech.edu"),
    university("West Georgia Technical College", "United States", "westgatech.edu"),
    university("Indian Institute of Technology, Bombay", "India", "iitb.ac.in"),
    university("Purdue University", "United States", "purdue.edu"),
    university("Purdue University Northwest", "United States", "pnw.edu"),
    university("Purdue University", "United States", "purdue.edu"),  # the real list has duplicates
    university("Monash University", "Australia", "monash.edu"),
]
client = TestClient(main.app)


@pytest.fixture(autouse=True)
def fake_university_list(monkeypatch):
    monkeypatch.setattr(options, "universities", lambda: UNIVERSITIES)


def names(response):
    return [school["name"] for school in response.json()]


def test_school_search_matches_every_word_in_any_order():
    assert names(client.get("/api/options/schools", params={"q": "bombay technology"})) == ["Indian Institute of Technology, Bombay"]


def test_school_search_puts_exact_and_prefix_matches_first():
    assert names(client.get("/api/options/schools", params={"q": "purdue university"})) == ["Purdue University", "Purdue University Northwest"]


def test_school_search_finds_acronyms():
    assert "Massachusetts Institute of Technology" in names(client.get("/api/options/schools", params={"q": "MIT"}))


def test_school_search_filters_by_country_and_limits():
    found = client.get("/api/options/schools", params={"q": "institute", "country": "india"}).json()
    assert {school["country"] for school in found} == {"India"}
    assert len(client.get("/api/options/schools", params={"limit": 2}).json()) == 2
    assert client.get("/api/options/schools", params={"limit": 0}).status_code == 422


def test_school_results_include_website_and_domains():
    monash = client.get("/api/options/schools", params={"q": "monash"}).json()[0]
    assert monash == {"name": "Monash University", "country": "Australia", "website": "https://www.monash.edu/", "domains": ["monash.edu"]}


def test_countries_are_unique_sorted_and_searchable():
    assert client.get("/api/options/countries").json() == ["Australia", "India", "United States"]
    assert client.get("/api/options/countries", params={"q": "ind"}).json() == ["India"]


def test_majors_are_searchable():
    assert client.get("/api/options/majors", params={"q": "comp"}).json() == ["Computer Science", "Computer Engineering"]
    assert len(client.get("/api/options/majors").json()) == len(options.MAJORS)


def test_terms_offer_seasons_and_the_next_years():
    terms = client.get("/api/options/terms").json()
    assert terms["seasons"] == ["Spring", "Summer", "Fall", "Winter"]
    assert terms["years"][0] == date.today().year and len(terms["years"]) == options.YEARS_AHEAD + 1


def test_university_list_outage_is_a_503(monkeypatch):
    def down():
        raise httpx.ConnectError("down")

    monkeypatch.setattr(options, "universities", down)
    assert client.get("/api/options/schools", params={"q": "x"}).status_code == 503
    assert client.get("/api/options/majors").status_code == 200  # majors don't need the list


def test_university_list_is_cached_on_disk(monkeypatch, tmp_path):
    monkeypatch.undo()  # use the real loader, with a temporary cache file
    monkeypatch.setattr(options, "CACHE_FILE", tmp_path / "universities.json")
    options.universities.cache_clear()
    downloads = []

    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return UNIVERSITIES

    monkeypatch.setattr(httpx, "get", lambda url, timeout, follow_redirects: downloads.append(url) or Response())
    assert len(options.universities()) == len(UNIVERSITIES)
    options.universities.cache_clear()
    assert len(options.universities()) == len(UNIVERSITIES)  # second load reads the file
    assert len(downloads) == 1
    options.universities.cache_clear()
