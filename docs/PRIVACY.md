# PenRX+ Privacy Policy (سياسة الخصوصية)

**Operator / المشغّل:** PenRX+ Medical Systems — data protection contact: `<privacy@your-domain>` · general: `<support@your-domain>`
**Version / الإصدار:** 1.61.0 · **Last updated / آخر تحديث:** 2026-10-28
**Hosting / الاستضافة:** Next.js deployment on Vercel (`fra1` — Frankfurt region); database on Supabase (AWS eu-central-1).

**We do not sell, rent, broker or advertise against any data. أبداً لا نبيع أو نؤجر أو نوسم على أي بيانات.**

---

## 1. Two kinds of data — and who owns them
| Data | Where it lives | Controller |
|---|---|---|
| **Patient & prescription records** (names, phone, diagnosis text, drugs, images) | **Only on the doctor's own device** — WebView/`localStorage` + IndexedDB, plus whatever the doctor prints/shares | **The doctor / the clinic** |
| **Licence & billing data** (device ID `PRX-XXXX-XXXX-XXXX`, doctor name, phone, syndicate licence number, subscription status, payment references) | PenRX+ cloud (Supabase via our own API) | PenRX+ Medical Systems |

Patient records are **the doctor's responsibility under Egyptian medical-confidentiality practice** (professional secrecy under the medical-profession law and Law No. 151/2020 on the protection of natural persons' personal data). Our servers do not receive, index or read patient identifiers during normal use: the licence endpoints only see the device ID, phone and status.

## 2. Exactly what leaves the device
* **Licence / subscription verification:** device fingerprint, phone number, app version, plan ID — polled over HTTPS to `/api/system/verify` and `/api/subscriptions`.
* **Optional encrypted backup:** a `.penrx` file uploaded to your cloud storage slot. It is compressed and encrypted with **AES-256-GCM**, key derived from **your** passphrase with **PBKDF2-SHA-256, 100,000 iterations**. *We cannot open it and cannot recover a lost passphrase.*
* **Optional drug crowdsourcing:** when a doctor saves a **new medicine** (not a patient record) it is published to the shared catalogue so other doctors can find it — name, active ingredient, form, dose, company only.
* **Optional AI assistance:** if you press the AI buttons, drug names and the clinical text of the current prescription are sent to **Google Gemini** to draft suggestions. Do not include patient identifiers in free-text you send to AI features.
* **Payments:** see §4 — no card or wallet credentials are stored by us.
* **Telemetry:** Next.js telemetry is disabled in all builds; there are no analytics or advertising SDKs in the APK/EXE.

## 3. Security measures
HTTPS-only transport (cleartext and mixed content are disabled on Android and in the desktop shell), per-device HMAC-signed licence tokens with server-side re-validation, server secrets held only in deployment environment variables (never inside the installer), httpOnly + SameSite=Strict admin sessions, strict CORS allowlist, request rate limiting, and an admin action audit log.

## 4. Payments (Vodafone Cash / InstaPay)
Subscriptions are paid manually through **Vodafone Cash** or **InstaPay** to the wallet number published on the official download page. We keep: your phone number, the amount, plan, date and the transfer reference you send us (screenshot/transaction ID) for reconciliation. **We never receive your bank app credentials, PIN or card numbers.**

## 5. Retention & deletion
* Licence/billing rows: kept while the subscription exists, then deleted on request within 30 days.
* Device bindings: removed on request so a replaced phone/PC can be re-activated.
* Your patient records: only you hold them — delete them inside the app, or delete the app data; a factory reset or uninstall removes them from the device.
* Cloud backups: deleted on request at `<privacy@your-domain>`; we cannot read them to help you recover a forgotten passphrase.

## 6. Your rights
Access, correction, deletion, and withdrawal of consent for the licence data we hold — write to `<privacy@your-domain>` from the phone number registered with your subscription. Complaints may also be filed with the Egyptian competent authority under Law 151/2020.

## 7. Not applicable
The service is for licensed prescribers, not children, and it collects no health data about patients from us directly.

## 8. Changes
Material changes are announced in the in-app update modal and in this file's `Last updated` line before the next release.

**Contact:** `<support@your-domain>` · `<privacy@your-domain>`
