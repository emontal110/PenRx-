#!/usr/bin/env node
/**
 * Generates the three PENRX_ADMIN_* values the portal login expects.
 * Secrets are read from the environment (never from argv, so they stay out of
 * shell history and `ps` output) and only the hashes are printed.
 *
 *   read -rs PW  && export PW
 *   read -rs PIN && export PIN
 *   read -rs SALT && export SALT
 *   node scripts/gen-admin-credentials.js
 */

const crypto = require("crypto");

const password = process.env.PW || "";
const pin = process.env.PIN || "";
const salt = process.env.SALT || "";

if (!password || !pin || !salt) {
  console.error("المطلوب: متغيرات PW و PIN و SALT في بيئة التنفيذ.");
  console.error('مثال:  read -rs PW && export PW  ثم  node scripts/gen-admin-credentials.js');
  process.exit(1);
}

if (String(pin).trim().length < 8) {
  console.error("رمز الأمان (PIN) يجب ألا يقل عن 8 أحرف/أرقام: تُشتق بصيغة SHA-256 بلا salt.");
  process.exit(1);
}

const passwordHash = crypto
  .pbkdf2Sync(password, Buffer.from(salt, "utf8"), 10000, 64, "sha512")
  .toString("hex");
const pinHash = crypto.createHash("sha256").update(String(pin).trim(), "utf8").digest("hex");

console.log("PENRX_ADMIN_SALT=" + salt);
console.log("PENRX_ADMIN_PASSWORD_HASH=" + passwordHash);
console.log("PENRX_ADMIN_PIN_HASH=" + pinHash);
