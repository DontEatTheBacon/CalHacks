import { test } from "node:test";
import assert from "node:assert/strict";
import { budgetFit, type CostItem, type Budget } from "../../convex/lib/rules/index.ts";

const rates = { EUR: 1, USD: 1.1, GBP: 0.85, IDR: 17000 }; // fixture, not real rates
const usd: Budget = { amount: 60000, currency: "USD", period: "annual", scope: "all_in" };
const item = (kind: CostItem["kind"], amount: number, over: Partial<CostItem> = {}): CostItem =>
  ({ kind, amount, currency: "USD", period: "annual", applicantCategory: "international", ...over });

test("AS5 missing living estimate: incomplete, never filled in", () => {
  const r = budgetFit([item("tuition", 40000), item("fee", 1000)], usd, 4, rates);
  assert.equal(r.band, "within_incomplete");
  assert.equal(r.complete, false);
  assert.deepEqual(r.missing, ["living"]);
  assert.equal(r.annualKnown, 41000);
});

test("complete and within", () => {
  assert.equal(budgetFit([item("tuition", 40000), item("fee", 1000), item("living", 15000)], usd, 4, rates).band, "within");
});

test("slightly over within 15%, over beyond it; a known lower bound above budget is over even if incomplete", () => {
  assert.equal(budgetFit([item("tuition", 50000), item("fee", 1000), item("living", 15000)], usd, 4, rates).band, "slightly_over");
  assert.equal(budgetFit([item("tuition", 80000)], usd, 4, rates).band, "over");
});

test("AS6 currency: GBP cost with USD budget converts with a rate, or is unknown without one", () => {
  const gbp = [item("tuition", 30000, { currency: "GBP" }), item("fee", 0, { currency: "GBP" }), item("living", 12000, { currency: "GBP" })];
  const r = budgetFit(gbp, usd, 3, rates);
  assert.ok(Math.abs(r.annualKnown! - 42000 / 0.85 * 1.1) < 0.01);
  const noRate = budgetFit(gbp, usd, 3, { EUR: 1, USD: 1.1 });
  assert.equal(noRate.band, "unknown");
  assert.ok(noRate.missing.includes("rate"));
});

test("domestic rates are never used; unknown tuition gives unknown", () => {
  const r = budgetFit([item("tuition", 10000, { applicantCategory: "domestic" })], usd, 4, rates);
  assert.equal(r.band, "unknown");
});

test("term amounts need a stated term count; totals need a sourced duration", () => {
  assert.equal(budgetFit([item("tuition", 20000, { period: "term" })], usd, 4, rates).band, "unknown");
  assert.equal(budgetFit([item("tuition", 20000, { period: "term", termsPerYear: 2 })], { ...usd, scope: "tuition_only" }, 4, rates).annualKnown, 40000);
  assert.equal(budgetFit([item("tuition", 160000, { period: "total" })], usd, null, rates).band, "unknown");
});

test("tuition-only budget ignores living costs", () => {
  const r = budgetFit([item("tuition", 40000), item("fee", 1000), item("living", 30000)], { ...usd, scope: "tuition_only" }, 4, rates);
  assert.equal(r.band, "within");
  assert.equal(r.annualKnown, 41000);
});
