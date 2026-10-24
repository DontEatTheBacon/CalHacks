"""Free, keyless open data that backs up the agent's answers.

- Frankfurter (https://frankfurter.dev): European Central Bank exchange rates.
- Hipolabs universities (https://github.com/Hipo/university-domains-list-api): official names, websites and
  domains, used to check whether a link is on the college's own site. Only served over plain http.
"""

import re
from datetime import date
from functools import cache
from urllib.parse import urlparse

import httpx

import tool_models as tm

FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest"
HIPOLABS_URL = "http://universities.hipolabs.com/search"
GOVERNMENT_HOST = re.compile(r"(^|\.)(gov(\.[a-z]{2})?|gc\.ca|europa\.eu)$")  # e.g. state.gov, gov.uk, canada.gc.ca


def exchange_rate(args: tm.ExchangeArgs) -> tm.ExchangeRate:
    """USD to the student's home currency, from the latest European Central Bank rates."""
    currency = args.currency.upper()
    response = httpx.get(FRANKFURTER_URL, params={"base": "USD", "symbols": currency}, timeout=10, follow_redirects=True)
    response.raise_for_status()
    body = response.json()
    if currency not in body.get("rates", {}):
        raise ValueError(f"no exchange rate for {currency}; use an ISO 4217 code like 'INR'")
    return tm.ExchangeRate(
        currency=currency,
        rate=body["rates"][currency],
        date=date.fromisoformat(body["date"]),
        link=tm.ResourceLink(url=f"https://api.frankfurter.dev/v1/latest?base=USD&symbols={currency}", label="European Central Bank rate", official=True),
    )


@cache
def find_university(name: str) -> dict | None:
    """The best Hipolabs match for a college name (exact name first), or None. Cached per name."""
    response = httpx.get(HIPOLABS_URL, params={"name": name}, timeout=10)
    response.raise_for_status()
    results = response.json()
    exact = [university for university in results if university["name"].lower() == name.lower()]
    return (exact or results or [None])[0]


def is_official(url: str, domains: list[str]) -> bool:
    """Whether a link is on one of the college's domains or a government site."""
    host = (urlparse(url).hostname or "").lower()
    return GOVERNMENT_HOST.search(host) is not None or any(host == d or host.endswith(f".{d}") for d in domains)


def college_domains(college: str) -> list[str]:
    try:
        university = find_university(college)
    except httpx.HTTPError:
        return []
    return university["domains"] if university else []


def mark_official_links(value, domains: list[str]):
    """Sets `official` on every link ({"url": ...}) inside a JSON-like tool result."""
    if isinstance(value, dict):
        if isinstance(value.get("url"), str):
            value["official"] = is_official(value["url"], domains)
        for item in value.values():
            mark_official_links(item, domains)
    elif isinstance(value, list):
        for item in value:
            mark_official_links(item, domains)
    return value
