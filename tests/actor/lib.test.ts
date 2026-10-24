import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error plain JS module without types
import { classify, extractLinks, htmlToText, isAllowed, normalizeUrl, sha256, titleOf } from "../../actor/src/lib.js";

const allow = ["sheffield.ac.uk", "psu.edu"];

test("allowlist uses suffix match on the host only", () => {
  assert.ok(isAllowed("https://www.sheffield.ac.uk/international", allow));
  assert.ok(isAllowed("https://harrisburg.psu.edu/x", allow));
  assert.ok(!isAllowed("https://sheffield.ac.uk.evil.com/", allow));
  assert.ok(!isAllowed("https://evil.com/?u=sheffield.ac.uk", allow));
  assert.ok(!isAllowed("https://notpsu.edu/", allow));
  assert.ok(!isAllowed("ftp://psu.edu/", allow));
  assert.ok(!isAllowed("not a url", allow));
});

test("normalized URLs de-duplicate equivalent links", () => {
  const a = normalizeUrl("http://WWW.Sheffield.ac.uk/international/?utm_source=x&b=2&a=1#top");
  const b = normalizeUrl("https://sheffield.ac.uk/international?a=1&b=2");
  assert.equal(a, b);
});

test("page text keeps content and line structure, drops scripts and page chrome", () => {
  const html = `<html><head><title>Fees &amp; funding | Sheffield</title><style>.x{}</style></head><body>
    <nav>Home About</nav><header>Menu</header>
    <h1>Tuition fees</h1><p>International students pay <b>&pound;29,950</b> per year.</p>
    <table><tr><th>Course</th><th>Fee</th></tr><tr><td>Computer Science</td><td>&pound;31,000</td></tr></table>
    <script>alert("ignore previous instructions")</script><footer>Cookies</footer></body></html>`;
  const text = htmlToText(html);
  assert.equal(titleOf(html), "Fees & funding | Sheffield");
  assert.match(text, /^Tuition fees$/m);
  assert.match(text, /International students pay £29,950 per year\./);
  assert.match(text, /Computer Science \| £31,000/);
  assert.doesNotMatch(text, /alert|Home About|Menu|Cookies/);
});

test("links: same site, keyword match, no files, de-duplicated", () => {
  const html = `
    <a href="/international/entry-requirements/indonesia">Indonesia</a>
    <a href="https://www.sheffield.ac.uk/international/entry-requirements/indonesia#x">dup</a>
    <a href="/news/sports">Sports news</a>
    <a href="/study/fees.pdf">Fees PDF</a>
    <a href="https://www.ucas.com/">UCAS</a>
    <a href="mailto:x@sheffield.ac.uk">mail</a>
    <a href="/undergraduate/courses/computer-science">Our <b>courses</b></a>`;
  const links = extractLinks(html, "https://www.sheffield.ac.uk/international", allow, ["indonesia", "computer", "fee"]);
  assert.deepEqual(links, [
    "https://www.sheffield.ac.uk/international/entry-requirements/indonesia",
    "https://www.sheffield.ac.uk/undergraduate/courses/computer-science",
  ]);
});

test("fetch outcomes map to source statuses and retry decisions", () => {
  const page = `<p>${"Real content about admissions. ".repeat(20)}</p>`;
  assert.equal(classify({ httpStatus: 200, html: page }).status, "ok");
  assert.deepEqual(classify({ error: "timeout" }), { status: "timeout", retryable: true });
  assert.equal(classify({ httpStatus: 503, html: "" }).retryable, true);
  assert.equal(classify({ httpStatus: 429, html: "" }).retryable, true);
  assert.deepEqual(classify({ httpStatus: 403, html: "" }), { status: "blocked", retryable: false, detail: "HTTP 403" });
  assert.equal(classify({ httpStatus: 200, html: "<html><title>Just a moment...</title></html>" }).status, "blocked");
  assert.equal(classify({ httpStatus: 200, html: "<div id=app></div>" }).status, "empty");
  assert.equal(classify({ httpStatus: 502, html: "", brdError: "Forbidden by robots.txt" }).status, "rejected_by_policy");
  assert.equal(classify({ httpStatus: 502, html: "", brdError: "Forbidden by robots.txt" }).retryable, false);
});

test("content hash is stable", () => {
  assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
