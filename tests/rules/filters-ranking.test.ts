import { test } from "node:test";
import assert from "node:assert/strict";
import { applyHardFilters, rank, majorRelevance, type Candidate } from "../../convex/lib/rules/index.ts";

const c = (id: string, over: Partial<Candidate> = {}): Candidate => ({
  id, name: id, country: "US", setting: "city", annualKnownCost: 50000,
  bands: { major: "direct", academic: "meets", budget: "within", climate: "match" }, ...over,
});

test("AS1 country filter: US only excludes GB; no country gives a prompt, never both", () => {
  const items = [c("a"), c("b", { country: "GB" })];
  assert.deepEqual(applyHardFilters(items, ["US"], []).results.map((i) => i.id), ["a"]);
  const none = applyHardFilters(items, [], []);
  assert.equal(none.results.length, 0);
  assert.equal(none.needsCountry, true);
});

test("AS2 setting filter: city only excludes countryside and unclassified, and counts unclassified", () => {
  const items = [c("city"), c("rural", { setting: "countryside" }), c("unk", { setting: "unclassified" })];
  const r = applyHardFilters(items, ["US"], ["city"]);
  assert.deepEqual(r.results.map((i) => i.id), ["city"]);
  assert.equal(r.unclassifiedExcluded, 1);
  assert.equal(applyHardFilters(items, ["US"], []).results.length, 3, "no setting chosen = no restriction");
});

test("AS3 non-exclusion: other major, over budget and below minimum stay listed", () => {
  const items = [
    c("other", { bands: { major: "other", academic: "meets", budget: "within", climate: "match" } }),
    c("over", { bands: { major: "direct", academic: "meets", budget: "over", climate: "match" } }),
    c("below", { bands: { major: "direct", academic: "below", budget: "within", climate: "match" } }),
  ];
  assert.equal(rank(applyHardFilters(items, ["US"], []).results).length, 3);
});

test("AS4 ranking: Direct beats Related regardless of academic; Meets > Needs confirmation > Below", () => {
  const direct = c("direct-below", { bands: { major: "direct", academic: "below", budget: "within", climate: "match" } });
  const related = c("related-meets", { bands: { major: "related", academic: "meets", budget: "within", climate: "match" } });
  assert.deepEqual(rank([related, direct]).map((i) => i.id), ["direct-below", "related-meets"]);

  const b = (id: string, academic: Candidate["bands"]["academic"]) => c(id, { bands: { major: "direct", academic, budget: "within", climate: "match" } });
  assert.deepEqual(rank([b("below", "below"), b("nc", "needs_confirmation"), b("meets", "meets")]).map((i) => i.id), ["meets", "nc", "below"]);
});

test("ranking tie-break: lower known cost, unknown cost last, then name", () => {
  const r = rank([c("z", { annualKnownCost: null }), c("b", { annualKnownCost: 40000 }), c("a", { annualKnownCost: 40000 }), c("y", { annualKnownCost: 30000 })]);
  assert.deepEqual(r.map((i) => i.id), ["y", "a", "b", "z"]);
});

test("major relevance from taxonomy config", () => {
  assert.equal(majorRelevance("cs", ["cs"]), "direct");
  assert.equal(majorRelevance("data_science", ["cs"]), "related");
  assert.equal(majorRelevance("finance", ["cs"]), "other");
  assert.equal(majorRelevance("history", ["cs"]), "other");
  assert.equal(majorRelevance(null, ["cs"]), "unknown");
});
