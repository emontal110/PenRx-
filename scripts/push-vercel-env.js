#!/usr/bin/env node
/**
 * Pushes environment variables from a local .env file into a Vercel project in
 * one shot, so the owner does not have to paste 14 values by hand.
 *
 *   read -rs VERCEL_TOKEN && export VERCEL_TOKEN
 *   node scripts/push-vercel-env.js --project=pen-rx --dry-run
 *   node scripts/push-vercel-env.js --project=pen-rx --apply
 *
 * The token is read from the environment only (never from argv or the .env file)
 * so it stays out of shell history and out of the repository.  Nothing that
 * looks like a secret value is ever printed — only key names.
 */

const fs = require("fs");
const path = require("path");

const API = "https://api.vercel.com";

function arg(name, fallback = "") {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const PROJECT = arg("project", "");
const TEAM = arg("team", "");
const TARGETS = arg("target", "production,preview").split(",").map((t) => t.trim()).filter(Boolean);
const FILE = arg("file", ".env");
const APPLY = process.argv.includes("--apply");
const LIST_ONLY = process.argv.includes("--list");
const SENSITIVE = arg("sensitive", "SUPABASE_SERVICE_ROLE_KEY,PENRX_SECRET_KEY,PENRX_ADMIN_SECRET,PENRX_ADMIN_PASSWORD_HASH,PENRX_ADMIN_PIN_HASH,PENRX_ADMIN_SALT,PENRX_ADMIN_EMAIL,GEMINI_API_KEY,DATABASE_URL")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const token = (process.env.VERCEL_TOKEN || "").trim();
if (!PROJECT) die("المطلوب: --project=<اسم المشروع أو المعرّف>");
if (!token) die(tokenHintText());

function die(message) {
  console.error(message);
  process.exit(1);
}

function tokenHintText() {
  return (
    "اضبط VERCEL_TOKEN في بيئة التنفيذ:\n" +
    "  PowerShell:  $s=Read-Host -AsSecureString 'VERCEL_TOKEN'; " +
    "$p=[Runtime.InteropServices.Marshal]::PtrToStringUni([Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($s)); " +
    "$env:VERCEL_TOKEN=$p\n" +
    "  Git Bash:    read -rs VERCEL_TOKEN && export VERCEL_TOKEN"
  );
}

/** Minimal KEY=VALUE parser: comments, blank lines and surrounding quotes only. */
function parseEnvFile(file) {
  const text = fs.readFileSync(file, "utf8");
  const out = [];
  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;
    const eq = line.indexOf("=");
    if (eq <= 0) return;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    let value = line.slice(eq + 1).trim();
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) return;
    out.push({ key, value });
  });
  return out;
}

function url(route) {
  const q = new URLSearchParams();
  if (TEAM) q.set("teamId", TEAM);
  return `${API}${route}${q.toString() ? `?${q}` : ""}`;
}

async function api(route, init = {}) {
  const res = await fetch(url(route), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const code = json?.error?.code || json?.message || `HTTP ${res.status}`;
    const err = new Error(`Vercel API فشل: ${code}`);
    err.route = route;
    err.badType = /\btype\b|encrypted|secret/i.test(String(code));
    throw err;
  }
  return json;
}

/**
 * Vercel renamed the secret type across API versions ("secret" -> "encrypted"),
 * so retry once with the other spelling instead of failing the whole batch.
 */
async function tryTypes(fn, candidates) {
  let lastError;
  for (const type of candidates) {
    try {
      return await fn(type);
    } catch (err) {
      lastError = err;
      if (!err.badType) throw err;
    }
  }
  throw lastError;
}

/** Keys the hardened build no longer reads — pushing them would re-publish dead credentials. */
const RETIRED_KEYS = ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_ADMIN_PORTAL_URL"];

/**
 * Local guards that mirror what the server itself enforces (src/lib/env.ts) plus
 * the credential family the owner just rotated to.  Catching these here saves a
 * failed deploy: the server fails closed at request time, not at build time.
 */
function validate({ key, value }) {
  const isHttpsUrl = (v) => /^https:\/\/[^\s/]+$/.test(v.replace(/\/+$/, ""));
  if (key === "PENRX_SECRET_KEY" || key === "PENRX_ADMIN_SECRET") {
    if (value.length < 32) return "يجب ألا تقل عن 32 حرفاً (يرفضها env.ts).";
  }
  if (key === "SUPABASE_SERVICE_ROLE_KEY") {
    // Supabase's current key format: NOT a JWT, and unaffected by signing-key rotation.
    if (value.startsWith("sb_secret_")) return "";
    if (value.startsWith("sb_publishable_")) {
      return "هذا مفتاح عام (publishable) بصلاحية anon — المسار الخادمي يحتاج sb_secret_.";
    }
    if (!value.startsWith("eyJ")) return "ليس مفتاح Supabase (توقّع sb_secret_… أو JWT).";
    const header = value.split(".")[0];
    let alg = "";
    try {
      alg = JSON.parse(Buffer.from(header, "base64url").toString("utf8")).alg || "";
    } catch {
      return "ترويسة المفتاح غير قابلة للفك.";
    }
    if (alg === "HS256") {
      return "مفتاح إرثي موقّع بـ HS256 المسرّب: لا يعمل بعد إلغاء مفتاح التوقيع HS256 — استبدله بـ sb_secret_ جديد.";
    }
    if (alg !== "ES256") return `خوارزمية التوقيع ${alg || "غير معروفة"} — المتوقع ES256 أو مفتاح sb_secret_ جديد.`;
  }
  if (key === "PENRX_ADMIN_PASSWORD_HASH" && !/^[0-9a-f]{128}$/.test(value)) return "المتوقع 128 حرفاً hex (PBKDF2-SHA512, keylen=64).";
  if (key === "PENRX_ADMIN_PIN_HASH" && !/^[0-9a-f]{64}$/.test(value)) return "المتوقع 64 حرفاً hex (SHA-256).";
  if (key === "PENRX_ADMIN_SALT" && value.length < 16) return "الملح قصير؛ استخدم 32 حرفاً عشوائياً.";
  if (key === "NEXT_PUBLIC_SUPABASE_URL" && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(value.replace(/\/+$/, ""))) {
    return "المتوقع https://<ref>.supabase.co تماماً.";
  }
  if (key === "PENRX_ADMIN_EMAIL" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return "بريد غير صالح.";
  if ((key === "NEXT_PUBLIC_APP_URL" || key === "PENRX_CLOUD_API_URL") && !isHttpsUrl(value)) {
    return "رابط HTTPS كامل بدون / في النهاية (localhost مرفوض).";
  }
  return "";
}

(async () => {
  const wanted = LIST_ONLY ? [] : parseEnvFile(path.resolve(FILE));

  if (!LIST_ONLY) {
    const retired = wanted.filter((v) => RETIRED_KEYS.includes(v.key));
    if (retired.length) {
      die(
        `متغيرات أُزيلت من المشروع لا ترسلها إلى Vercel: ${retired.map((r) => r.key).join(", ")} — احذف أسطرهم من ${FILE}.`
      );
    }
    const bad = wanted.filter((v) => !v.value || v.value.startsWith("<") || v.value.includes("paste-"));
    if (bad.length) die(`قيم غير مكتملة في ${FILE}: ${bad.map((b) => b.key).join(", ")} — اكتب القيم الحقيقية أولاً.`);
    const invalid = wanted.map((v) => ({ ...v, why: validate(v) })).filter((v) => v.why);
    if (invalid.length) {
      console.error("تحققت من القيم فوجدت مشاكل (بدون إظهار أي قيمة):");
      for (const v of invalid) console.error(`  ${v.key}: ${v.why}`);
      process.exit(1);
    }
    const publicOnly = wanted.some((v) => v.key.startsWith("NEXT_PUBLIC_") && SENSITIVE.includes(v.key));
    if (publicOnly) die("متغير NEXT_PUBLIC_* موصوف كسر: انزع البادئة أو أزل السردية.");
  }

  const existing = (await api(`/v9/projects/${encodeURIComponent(PROJECT)}/env`))?.env || [];
  const byKey = new Map();
  for (const item of existing) {
    if (!byKey.has(item.key)) byKey.set(item.key, []);
    byKey.get(item.key).push(item);
  }

  if (LIST_ONLY) {
    console.log("المتغيرات المضبوطة على Vercel (أسماء فقط):");
    for (const item of existing) console.log(`  ${item.key}  [${item.type}] ${item.target?.join(",") || "-"}`);
    return;
  }

  const created = [];
  const updated = [];
  const skipped = [];

  for (const { key, value } of wanted) {
    const isSensitive = SENSITIVE.includes(key);
    const candidates = isSensitive ? ["secret", "encrypted"] : ["plain"];
    const matches = (byKey.get(key) || []).filter((item) =>
      (item.target || []).some((t) => TARGETS.includes(t))
    );

    if (matches.length === 0) {
      created.push({ key, sensitive: isSensitive });
      if (APPLY) {
        await tryTypes((type) =>
          api(`/v9/projects/${encodeURIComponent(PROJECT)}/env`, {
            method: "POST",
            body: JSON.stringify({
              env: [{ key, value, type, target: TARGETS, comment: "set by scripts/push-vercel-env.js" }],
            }),
          }),
          candidates
        );
      }
      continue;
    }

    for (const item of matches) {
      updated.push({ key, id: item.id });
      if (APPLY) {
        await tryTypes((type) =>
          api(`/v9/projects/${encodeURIComponent(PROJECT)}/env/${item.id}`, {
            method: "PATCH",
            body: JSON.stringify({ value, type, target: TARGETS }),
          }),
          candidates
        );
      }
    }
  }

  for (const item of existing) {
    if (!wanted.some((w) => w.key === item.key)) skipped.push(item.key);
  }

  console.log(`الملف: ${FILE}`);
  console.log(`المشروع: ${PROJECT}  |  النطاقات: ${TARGETS.join(", ")}`);
  console.log(`إنشاء: ${created.map((c) => c.key).join(", ") || "—"}`);
  console.log(`تحديث: ${updated.map((u) => u.key).join(", ") || "—"}`);
  if (skipped.length) console.log(`على Vercel وغير موجود في الملف (لن يُمسّ): ${skipped.join(", ")}`);
  console.log(APPLY ? "\nتم التطبيق. الخطوة التالية: Redeploy لتسري القيم." : "\nDry-run فقط — أضف --apply للتنفيذ.");
})().catch((err) => die(err.message));
