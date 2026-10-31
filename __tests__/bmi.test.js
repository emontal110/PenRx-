const { test, describe } = require("node:test");
const assert = require("node:assert");

function calculateBmiInfo(height, weight) {
  if (!height || !weight) return null;
  const hNum = typeof height === "number" ? height : parseFloat(String(height));
  const wNum = typeof weight === "number" ? weight : parseFloat(String(weight));
  if (isNaN(hNum) || isNaN(wNum) || hNum <= 30 || hNum > 260 || wNum <= 2 || wNum > 400) {
    return null;
  }
  const hMeters = hNum / 100;
  const bmiVal = wNum / (hMeters * hMeters);
  if (!isFinite(bmiVal) || bmiVal <= 5 || bmiVal >= 100) return null;

  const bmiFormatted = bmiVal.toFixed(1);
  if (bmiVal < 18.5) {
    return { bmi: bmiVal, bmiFormatted, category: "underweight" };
  } else if (bmiVal < 25) {
    return { bmi: bmiVal, bmiFormatted, category: "normal" };
  } else if (bmiVal < 30) {
    return { bmi: bmiVal, bmiFormatted, category: "overweight" };
  } else {
    return { bmi: bmiVal, bmiFormatted, category: "obese" };
  }
}

describe("Clinical BMI Calculator", () => {
  test("calculates normal BMI accurately", () => {
    // 70 kg, 175 cm -> 70 / (1.75 * 1.75) = 22.86
    const res = calculateBmiInfo(175, 70);
    assert.ok(res);
    assert.strictEqual(res.bmiFormatted, "22.9");
    assert.strictEqual(res.category, "normal");
  });

  test("identifies overweight and underweight categories", () => {
    const underweight = calculateBmiInfo(180, 50);
    assert.strictEqual(underweight.category, "underweight");

    const overweight = calculateBmiInfo(170, 80);
    assert.strictEqual(overweight.category, "overweight");
  });

  test("rejects invalid or extreme values gracefully", () => {
    assert.strictEqual(calculateBmiInfo(0, 70), null);
    assert.strictEqual(calculateBmiInfo(170, 0), null);
    assert.strictEqual(calculateBmiInfo("invalid", "data"), null);
  });
});
