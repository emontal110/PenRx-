const { test, describe } = require("node:test");
const assert = require("node:assert");

const PLANS = [
  { id: "trial", nameAr: "الفترة التجريبية المجانية", durationDays: 30, priceEGP: 0, isTrial: true },
  { id: "monthly", nameAr: "الاشتراك الشهري", durationDays: 30, priceEGP: 150, isTrial: false },
  { id: "quarterly", nameAr: "اشتراك 3 شهور", durationDays: 90, priceEGP: 400, isTrial: false },
  { id: "semi_annual", nameAr: "اشتراك 6 شهور", durationDays: 180, priceEGP: 800, isTrial: false },
  { id: "annual_vip", nameAr: "الاشتراك السنوي VIP", durationDays: 365, priceEGP: 1500, isTrial: false },
];

const PLAN_ALIASES = {
  semiannual: "semi_annual",
  annual: "annual_vip",
  yearly: "annual_vip",
};

function resolvePlan(planId) {
  const clean = (planId || "").trim().toLowerCase();
  const id = PLAN_ALIASES[clean] || clean;
  return PLANS.find((p) => p.id === id) || null;
}

describe("Paid Plans and Subscription Engine", () => {
  test("resolves canonical plan definitions accurately", () => {
    const monthly = resolvePlan("monthly");
    assert.ok(monthly);
    assert.strictEqual(monthly.priceEGP, 150);
    assert.strictEqual(monthly.durationDays, 30);

    const vip = resolvePlan("annual_vip");
    assert.ok(vip);
    assert.strictEqual(vip.priceEGP, 1500);
  });

  test("resolves legacy and shorthand aliases correctly", () => {
    assert.strictEqual(resolvePlan("yearly")?.id, "annual_vip");
    assert.strictEqual(resolvePlan("annual")?.id, "annual_vip");
    assert.strictEqual(resolvePlan("semiannual")?.id, "semi_annual");
  });

  test("returns null for non-existent plans", () => {
    assert.strictEqual(resolvePlan("non-existent-plan"), null);
    assert.strictEqual(resolvePlan(""), null);
  });
});
