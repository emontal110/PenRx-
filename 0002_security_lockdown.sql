-- =========================================================================
-- PenRX+ Security Lockdown  (run once in Supabase -> SQL Editor)
--
-- Effect: the browser role `anon` and `authenticated` lose ALL direct access to
-- subscription and medical tables. Only the PenRX+ API, which connects with the
-- service-role key, can read or write them. Run this AFTER rotating the leaked
-- keys, otherwise the old portal can no longer reach the data it still holds.
-- =========================================================================

-- 0) Columns the hardened API writes ----------------------------------------
ALTER TABLE "Drug" ADD COLUMN IF NOT EXISTS "addedBy" TEXT;

-- 1) Drop the permissive anon/authenticated policies on Subscription ---------
DROP POLICY IF EXISTS "anon_insert_pending_sub" ON "Subscription";
DROP POLICY IF EXISTS "anon_select_sub"         ON "Subscription";
DROP POLICY IF EXISTS "anon_update_sub"         ON "Subscription";
DROP POLICY IF EXISTS "anon_delete_sub"         ON "Subscription";

-- 2) Admin audit trail ------------------------------------------------------
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "action"         TEXT NOT NULL,
    "subscriptionId" TEXT,
    "subscriberId"   TEXT,
    "detail"         JSONB NOT NULL DEFAULT '{}'::jsonb,
    "ip"             TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3) Enable RLS everywhere and revoke client privileges ----------------------
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'Subscription', 'CloudPrescription', 'CloudBackup', 'AdminAuditLog',
        'Clinic', 'Branch', 'User', 'Patient', 'Prescription', 'PrescriptionItem', 'Drug'
    ] LOOP
        IF to_regclass('public.' || t) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

            IF t <> 'Drug' THEN
                EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
            ELSE
                -- Public catalogue: readable, but contributions go through the API.
                EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.%I FROM anon, authenticated', t);
                EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', t);
            END IF;

            EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
        END IF;
    END LOOP;
END $$;

-- 4) service_role-only policies ---------------------------------------------
DROP POLICY IF EXISTS "service_role_all_sub"        ON "Subscription";
DROP POLICY IF EXISTS "service_role_all_audit"      ON "AdminAuditLog";

CREATE POLICY "service_role_all_sub" ON "Subscription"
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_audit" ON "AdminAuditLog"
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5) Supporting indexes used by the new license lookups ---------------------
CREATE INDEX IF NOT EXISTS "Subscription_subscriberId_idx" ON "Subscription"("subscriberId");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx"       ON "Subscription"("status");
CREATE INDEX IF NOT EXISTS "Subscription_updatedAt_idx"    ON "Subscription"("updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx"   ON "AdminAuditLog"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AdminAuditLog_subscriber_idx"  ON "AdminAuditLog"("subscriberId");
CREATE INDEX IF NOT EXISTS "CloudBackup_subscriberId_idx"  ON "CloudBackup"("subscriberId");

-- 6) Verify (should return 0 for anon on every medical/subscription table) --
SELECT table_name, privilege_type
FROM information_schema.table_privileges
WHERE grantee IN ('anon', 'authenticated')
  AND table_schema = 'public'
  AND table_name IN ('Subscription', 'CloudPrescription', 'CloudBackup', 'Patient', 'Prescription')
ORDER BY table_name, privilege_type;
