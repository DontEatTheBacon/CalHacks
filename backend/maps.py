"""Google Maps Routes API: ground routes with transport types and line names.

https://developers.google.com/maps/documentation/routes/compute_route_directions
Needs GOOGLE_MAPS_API_KEY with the Routes API enabled. Google doesn't route flights.
"""

import os

import httpx

from tool_models import TravelInfo

URL = "https://routes.googleapis.com/directions/v2:computeRoutes"
FIELD_MASK = ",".join([
    "routes.duration",
    "routes.travelAdvisory.transitFare",
    "routes.legs.steps.travelMode",
    "routes.legs.steps.staticDuration",
    "routes.legs.steps.transitDetails.transitLine",
    "routes.legs.steps.transitDetails.stopDetails.departureStop.name",
    "routes.legs.steps.transitDetails.stopDetails.arrivalStop.name",
])


def ground_route(origin: str, destination: str) -> TravelInfo | None:
    """Public transport route, or a driving route if there's no transit; None without a key or a route."""
    if not os.getenv("GOOGLE_MAPS_API_KEY"):
        return None
    if route := _compute(origin, destination, "TRANSIT"):
        return _transit_legs(route, destination)
    if route := _compute(origin, destination, "DRIVE"):
        return TravelInfo(
            banned_travel_forms=[],
            travel_forms=["car"],
            travel_duration=[round(_hours(route["duration"]), 2)],
            travel_destinations=[destination],
            line_names=[None],
            source="Google Maps",
        )
    return None


def _compute(origin: str, destination: str, mode: str) -> dict | None:
    response = httpx.post(
        URL,
        headers={"X-Goog-Api-Key": os.environ["GOOGLE_MAPS_API_KEY"], "X-Goog-FieldMask": FIELD_MASK},
        json={"origin": {"address": origin}, "destination": {"address": destination}, "travelMode": mode},
        timeout=15,
    )
    response.raise_for_status()
    routes = response.json().get("routes") or []
    return routes[0] if routes else None


def _hours(duration: str) -> float:
    return int(duration.rstrip("s") or 0) / 3600  # Google durations look like "1234s"


def _transit_legs(route: dict, destination: str) -> TravelInfo:
    forms, hours, ends, lines, starts = [], [], [], [], []
    for step in (step for leg in route["legs"] for step in leg.get("steps", [])):
        duration = _hours(step.get("staticDuration", "0s"))
        if step.get("travelMode") != "TRANSIT":
            # Google splits walks into many small steps; merge them into one leg.
            if forms and forms[-1] == "walk":
                hours[-1] += duration
                continue
            forms.append("walk")
            hours.append(duration)
            ends.append(None)  # filled in below: wherever the next leg starts
            lines.append(None)
            starts.append(None)
            continue
        details = step["transitDetails"]
        line = details["transitLine"]
        vehicle = line.get("vehicle", {})
        forms.append(vehicle.get("name", {}).get("text", vehicle.get("type", "transit")).lower())
        hours.append(duration)
        ends.append(details["stopDetails"]["arrivalStop"]["name"])
        lines.append(line.get("name") or line.get("nameShort"))
        starts.append(details["stopDetails"]["departureStop"]["name"])

    # A walk ends where the next transit leg starts, or at the destination.
    for i, end in enumerate(ends):
        if end is None:
            ends[i] = next((start for start in starts[i + 1:] if start), destination)

    return TravelInfo(
        banned_travel_forms=[],
        travel_forms=forms,
        travel_duration=[round(h, 2) for h in hours],
        travel_destinations=ends,
        line_names=lines,
        fare_usd=_fare_usd(route),
        source="Google Maps",
    )


def _fare_usd(route: dict) -> float | None:
    fare = route.get("travelAdvisory", {}).get("transitFare")
    if not fare or fare.get("currencyCode") != "USD":
        return None
    return round(int(fare.get("units", 0)) + fare.get("nanos", 0) / 1e9, 2)
