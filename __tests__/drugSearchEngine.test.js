const { test, describe } = require("node:test");
const assert = require("node:assert");

function buildDrugEyeWildcardRegex(rawQuery) {
  const trimmed = (rawQuery || "").trim();
  if (!trimmed) return null;
  const segments = trimmed
    .split(/[\s*]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"));
  if (segments.length === 0) return null;
  return new RegExp(segments.join(".*"), "i");
}

describe("Drug Eye Wildcard & Progressive Alphabetical Search", () => {
  test("matches *gm*n*600 against Augmentin ES 600mg", () => {
    const rx = buildDrugEyeWildcardRegex("*gm*n*600");
    assert.ok(rx);
    assert.strictEqual(rx.test("Augmentin ES 600mg Suspension"), true);
    assert.strictEqual(rx.test("Panadol 500mg Tablets"), false);
  });

  test("matches space-separated tokens like 'concor 5'", () => {
    const rx = buildDrugEyeWildcardRegex("concor 5");
    assert.ok(rx);
    assert.strictEqual(rx.test("Concor 5mg Tablets"), true);
    assert.strictEqual(rx.test("Concor 5 Plus Tablets"), true);
  });
});
