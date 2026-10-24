import { test } from "node:test";
import assert from "node:assert/strict";
import { classifySetting, classifyClimate, climateFit, deadlineRisk, daysAvailable, backPlan, nextCounselor, isAllowedUrl, ianaZone } from "../../convex/lib/rules/index.ts";

test("setting classification by population with an unclassified band", () => {
  const e = (population: number | null, distanceKm: number | null = 3) => ({ campusId: "x", settlement: "Town", population, distanceKm });
  assert.equal(classifySetting(e(500000)).setting, "city");
  assert.equal(classifySetting(e(20000)).setting, "countryside");
  assert.equal(classifySetting(e(75000)).setting, "unclassified");
  assert.equal(classifySetting(e(500000, 40)).setting, "unclassified");
  assert.equal(classifySetting(e(null)).setting, "unclassified");
});

test("climate classes and fit", () => {
  assert.equal(classifyClimate({ annualMeanC: 18, coldestMonthMeanC: 10 }), "warm");
  assert.equal(classifyClimate({ annualMeanC: 11, coldestMonthMeanC: 5 }), "mild");
  assert.equal(classifyClimate({ annualMeanC: 9, coldestMonthMeanC: -2 }), "cool");
  assert.equal(classifyClimate({ annualMeanC: 7, coldestMonthMeanC: -9 }), "cold");
  assert.equal(climateFit("mild", "mild"), "match");
  assert.equal(climateFit("mild", "cool"), "partial");
  assert.equal(climateFit("mild", "cold"), "mismatch");
  assert.equal(climateFit("mild", null), "unknown");
  assert.equal(climateFit("none", "cold"), "match");
});

test("AS12 date-only deadlines use the published timezone; unknown timezone is conservative", () => {
  const now = new Date("2026-11-01T03:00:00Z"); // 23:00 Oct 31 in New York, 03:00 Nov 1 in London
  assert.equal(daysAvailable({ date: "2026-11-01", timezone: "America/New_York" }, now), 1);
  assert.equal(daysAvailable({ date: "2026-11-01", timezone: "Europe/London" }, now), 0);
  assert.equal(daysAvailable({ date: "2026-11-01", timezone: null }, now), 0);
});

test("deadline risk bands", () => {
  const now = new Date("2026-10-24T12:00:00Z");
  const d = (date: string) => ({ date, timezone: "Europe/London" });
  assert.equal(deadlineRisk(null, 30, now), "unknown");
  assert.equal(deadlineRisk(d("2026-10-01"), 30, now), "closed");
  assert.equal(deadlineRisk(d("2027-01-15"), 30, now), "on_track"); // 83 days vs 37 needed
  assert.equal(deadlineRisk(d("2026-12-03"), 30, now), "tight");    // 40 days vs 37..46
  assert.equal(deadlineRisk(d("2026-11-20"), 30, now), "at_risk");  // 27 days
});

test("AS11 back-planning gives recommended targets separate from the official date", () => {
  const plan = backPlan("2027-01-15", [{ key: "official_score_delivery", leadDays: 14 }, { key: "test_date", leadDays: 14 }]);
  assert.deepEqual(plan, [{ key: "official_score_delivery", recommendedBy: "2026-12-25" }, { key: "test_date", recommendedBy: "2026-12-11" }]);
});

test("AS16 round robin: three counselors, four requests, fourth returns to the first", () => {
  const cs = [{ id: "ayu", rotationOrder: 1, active: true }, { id: "budi", rotationOrder: 2, active: true }, { id: "citra", rotationOrder: 3, active: true }];
  let pointer: number | null = null;
  const got: string[] = [];
  for (let i = 0; i < 4; i++) {
    const a = nextCounselor(cs, pointer);
    assert.equal(a.status, "assigned");
    if (a.status === "assigned") { got.push(a.counselorId); pointer = a.newPointer; }
  }
  assert.deepEqual(got, ["ayu", "budi", "citra", "ayu"]);
});

test("round robin: inactive skipped, none active is pending, existing assignment kept", () => {
  const cs = [{ id: "ayu", rotationOrder: 1, active: true }, { id: "budi", rotationOrder: 2, active: false }, { id: "citra", rotationOrder: 3, active: true }];
  const a = nextCounselor(cs, 1);
  assert.equal(a.status === "assigned" && a.counselorId, "citra");
  assert.equal(nextCounselor(cs.map((c) => ({ ...c, active: false })), 1).status, "pending");
  const kept = nextCounselor(cs, 3, "ayu");
  assert.ok(kept.status === "assigned" && kept.reused && kept.counselorId === "ayu" && kept.newPointer === 3);
});

test("domain allowlist", () => {
  assert.ok(isAllowedUrl("https://www.cs.wisc.edu/undergraduate"));
  assert.ok(isAllowedUrl("https://www.ucas.com/"));
  assert.ok(!isAllowedUrl("https://notwisc.edu/"));
  assert.ok(!isAllowedUrl("https://wisc.edu.evil.com/"));
  assert.ok(!isAllowedUrl("https://user:pw@wisc.edu/"));
  assert.ok(!isAllowedUrl("ftp://wisc.edu/"));
  assert.ok(!isAllowedUrl("http://10.0.0.1/"));
});

test("published timezone wording maps to IANA names; unknown wording stays unknown and never crashes", () => {
  assert.equal(ianaZone("UK time"), "Europe/London");
  assert.equal(ianaZone("ET"), "America/New_York");
  assert.equal(ianaZone("America/Chicago"), "America/Chicago");
  assert.equal(ianaZone("Mars/Olympus"), null);
  assert.equal(ianaZone("midnight-ish"), null);
  assert.equal(ianaZone(null), null);
  assert.equal(deadlineRisk({ date: "2027-01-13", timezone: ianaZone("UK time") }, 0, new Date("2026-10-24T12:00:00Z")), "on_track");
});
