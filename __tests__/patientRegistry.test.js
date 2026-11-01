const { test, describe } = require("node:test");
const assert = require("node:assert");

function normalizePatientName(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/[أإآٱء]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىي]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[^\w\s\u0600-\u06FF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhoneDigits(phone) {
  if (!phone) return "";
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const normalized = phone.replace(/[٠-٩]/g, (d) => {
    const idx = arabicDigits.indexOf(d);
    return idx >= 0 ? String(idx) : d;
  });
  return normalized.replace(/[^0-9]/g, "");
}

describe("Patient Registry & Arabic Normalization", () => {
  test("normalizes Alef and Hamza variations correctly", () => {
    assert.strictEqual(normalizePatientName("أحمد"), "احمد");
    assert.strictEqual(normalizePatientName("إبراهيم"), "ابراهيم");
    assert.strictEqual(normalizePatientName("آدم"), "ادم");
  });

  test("normalizes Ta Marbuta and Alef Maksura", () => {
    assert.strictEqual(normalizePatientName("فاطمة"), "فاطمه");
    assert.strictEqual(normalizePatientName("منى"), "مني");
  });

  test("strips Arabic diacritics (Tashkeel) and extra spaces", () => {
    assert.strictEqual(normalizePatientName("مُحَمَّدٌ   عَلِيٌّ"), "محمد علي");
  });

  test("converts Eastern Arabic numerals to standard digits", () => {
    assert.strictEqual(normalizePhoneDigits("٠١٠٩٤٠٨٥٢٢٨"), "01094085228");
    assert.strictEqual(normalizePhoneDigits("+20 010-9408-5228"), "2001094085228");
  });
});

