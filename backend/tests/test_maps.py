import httpx
import pytest

import agent
import maps
import tool_models as tm

DESTINATION = "Georgia Institute of Technology"


def walk(seconds):
    return {"travelMode": "WALK", "staticDuration": f"{seconds}s"}


def transit(seconds, line, vehicle, departure, arrival):
    return {
        "travelMode": "TRANSIT",
        "staticDuration": f"{seconds}s",
        "transitDetails": {
            "transitLine": {"name": line, "vehicle": {"type": vehicle.upper(), "name": {"text": vehicle}}},
            "stopDetails": {"departureStop": {"name": departure}, "arrivalStop": {"name": arrival}},
        },
    }


TRANSIT_ROUTE = {
    "duration": "2700s",
    "travelAdvisory": {"transitFare": {"currencyCode": "USD", "units": "2", "nanos": 500000000}},
    "legs": [{"steps": [
        walk(120), walk(180),
        transit(1500, "MARTA Red Line", "Subway", "Airport Station", "North Avenue Station"),
        walk(240), walk(360),
    ]}],
}


@pytest.fixture
def google(monkeypatch):
    """Sets a fake key and answers _compute from a {mode: route} dict."""
    routes = {}
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "test")
    monkeypatch.setattr(maps, "_compute", lambda origin, destination, mode: routes.get(mode))
    return routes


def test_no_key_means_no_google_call():
    assert maps.ground_route("ATL", DESTINATION) is None  # httpx.post is blocked, so this would fail if called


def test_transit_route_merges_walks_and_keeps_line_names(google):
    google["TRANSIT"] = TRANSIT_ROUTE
    route = maps.ground_route("ATL", DESTINATION)
    assert route.travel_forms == ["walk", "subway", "walk"]
    assert route.travel_destinations == ["Airport Station", "North Avenue Station", DESTINATION]
    assert route.line_names == [None, "MARTA Red Line", None]
    assert route.travel_duration == [round(300 / 3600, 2), round(1500 / 3600, 2), round(600 / 3600, 2)]
    assert route.fare_usd == 2.5
    assert route.source == "Google Maps"


def test_non_usd_fare_is_left_empty(google):
    google["TRANSIT"] = {**TRANSIT_ROUTE, "travelAdvisory": {"transitFare": {"currencyCode": "AUD", "units": "5"}}}
    assert maps.ground_route("MEL", "Monash University").fare_usd is None


def test_falls_back_to_driving_without_transit(google):
    google["DRIVE"] = {"duration": "1500s", "legs": []}
    route = maps.ground_route("ATL", DESTINATION)
    assert route.travel_forms == ["car"]
    assert route.travel_duration == [0.42]
    assert route.source == "Google Maps"


def test_no_route_at_all_returns_none(google):
    assert maps.ground_route("ATL", DESTINATION) is None


def gemini_route(prompt, schema):
    return tm.TravelInfo(banned_travel_forms=[], travel_forms=["train"], travel_duration=[0.5], travel_destinations=[DESTINATION])


@pytest.mark.parametrize("lookup", [lambda o, d: None, lambda o, d: (_ for _ in ()).throw(httpx.ConnectError("down"))])
def test_ground_route_tool_falls_back_to_gemini(monkeypatch, lookup):
    monkeypatch.setattr(maps, "ground_route", lookup)
    monkeypatch.setattr(agent, "ask_structured", gemini_route)
    route = agent.ground_route(tm.GroundRouteArgs(origin="ATL", college=DESTINATION))
    assert route.travel_forms == ["train"]
    assert route.source == "Gemini estimate"


def test_ground_route_tool_prefers_google(monkeypatch, google):
    google["TRANSIT"] = TRANSIT_ROUTE
    monkeypatch.setattr(agent, "ask_structured", lambda prompt, schema: pytest.fail("should not ask Gemini"))
    assert agent.ground_route(tm.GroundRouteArgs(origin="ATL", college=DESTINATION)).source == "Google Maps"
