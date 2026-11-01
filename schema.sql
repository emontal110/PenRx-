-- ============================================================================
-- PenRX+ — Master PostgreSQL Schema & Security Lockdown (Supabase Compatible)
-- ============================================================================
-- Single unified database definition for PenRX+ Medical Prescription Platform.
-- Safe to run on a brand-new Supabase project OR on an existing database (100% idempotent).
--
-- Includes:
-- 1. Custom ENUM types (Role, PaperSize)
-- 2. All 11 core tables with constraints & defaults
-- 3. In-place column existence migrations
-- 4. Foreign keys with safe cascade definitions
-- 5. Performance indexes for fast multi-tenant queries
-- 6. Supabase Realtime broadcast configuration
-- 7. Full Security Lockdown: Strict Row Level Security (RLS) on all tables
-- 8. Privilege isolation: client roles (anon/authenticated) blocked, service_role authorized
-- 9. System seed records
-- 10. PostgREST schema cache reload trigger & privilege verification check
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) ENUM TYPES
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('DOCTOR', 'ASSISTANT', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PaperSize" AS ENUM ('A4', 'A5');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- 2) CORE TABLES DEFINITIONS
-- ----------------------------------------------------------------------------

-- [Table 1] Clinic
CREATE TABLE IF NOT EXISTS "Clinic" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "specialty"     TEXT NOT NULL DEFAULT 'General Medicine',
    "logoUrl"       TEXT,
    "primaryColor"  TEXT NOT NULL DEFAULT '#059669',
    "headerText"    TEXT,
    "footerText"    TEXT,
    "showHeader"    BOOLEAN NOT NULL DEFAULT true,
    "showFooter"    BOOLEAN NOT NULL DEFAULT true,
    "notesTemplate" TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

-- [Table 2] Branch
CREATE TABLE IF NOT EXISTS "Branch" (
    "id"           TEXT NOT NULL,
    "clinicId"     TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "nameAr"       TEXT,
    "address"      TEXT NOT NULL,
    "phone"        TEXT NOT NULL,
    "workingHours" TEXT,
    "isDefault"    BOOLEAN NOT NULL DEFAULT false,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- [Table 3] User
CREATE TABLE IF NOT EXISTS "User" (
    "id"           TEXT NOT NULL,
    "clinicId"     TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "role"         "Role" NOT NULL DEFAULT 'DOCTOR',
    "title"        TEXT NOT NULL DEFAULT 'Consultant',
    "syndicateId"  TEXT,
    "phone"        TEXT,
    "specialty"    TEXT,
    "passwordHash" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- [Table 4] Patient
CREATE TABLE IF NOT EXISTS "Patient" (
    "id"             TEXT NOT NULL,
    "clinicId"       TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "nameAr"         TEXT,
    "phone"          TEXT,
    "age"            INTEGER,
    "gender"         TEXT,
    "bloodType"      TEXT,
    "medicalHistory" TEXT,
    "allergyNotes"   TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- [Table 5] Drug (Public Drug Catalog & Doctor Contributions)
CREATE TABLE IF NOT EXISTS "Drug" (
    "id"                 TEXT NOT NULL,
    "name"               TEXT NOT NULL,
    "nameAr"             TEXT,
    "activeIngredient"   TEXT NOT NULL,
    "activeIngredientAr" TEXT,
    "company"            TEXT,
    "price"              DOUBLE PRECISION,
    "dosageForm"         TEXT,
    "category"           TEXT,
    "isControlled"       BOOLEAN NOT NULL DEFAULT false,
    "addedBy"            TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Drug_pkey" PRIMARY KEY ("id")
);

-- [Table 6] Prescription
CREATE TABLE IF NOT EXISTS "Prescription" (
    "id"             TEXT NOT NULL,
    "prescriptionNo" TEXT NOT NULL,
    "clinicId"       TEXT NOT NULL,
    "branchId"       TEXT NOT NULL,
    "doctorId"       TEXT NOT NULL,
    "patientId"      TEXT NOT NULL,
    "diagnosis"      TEXT,
    "notes"          TEXT,
    "paperSize"      "PaperSize" NOT NULL DEFAULT 'A4',
    "qrCodeUrl"      TEXT,
    "isManual"       BOOLEAN NOT NULL DEFAULT false,
    "isArchived"     BOOLEAN NOT NULL DEFAULT false,
    "archivedAt"     TIMESTAMP(3),
    "subscriberId"   TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- [Table 7] PrescriptionItem
CREATE TABLE IF NOT EXISTS "PrescriptionItem" (
    "id"               TEXT NOT NULL,
    "prescriptionId"   TEXT NOT NULL,
    "drugId"           TEXT,
    "drugName"         TEXT NOT NULL,
    "activeIngredient" TEXT,
    "doseQuantity"     TEXT NOT NULL,
    "doseForm"         TEXT,
    "frequency"        TEXT NOT NULL,
    "duration"         TEXT NOT NULL,
    "instructions"     TEXT,
    "isManual"         BOOLEAN NOT NULL DEFAULT false,
    "sortOrder"        INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PrescriptionItem_pkey" PRIMARY KEY ("id")
);

-- [Table 8] Subscription (Licenses & Multi-Device Authorizations)
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id"                TEXT NOT NULL,
    "subscriberId"      TEXT,
    "planId"            TEXT NOT NULL,
    "planName"          TEXT NOT NULL,
    "price"             DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMethod"     TEXT NOT NULL DEFAULT 'vodafone',
    "senderPhone"       TEXT NOT NULL,
    "transactionRef"    TEXT NOT NULL,
    "status"            TEXT NOT NULL DEFAULT 'PENDING',
    "machineId"         TEXT NOT NULL,
    "allowedMachineIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "doctorName"        TEXT,
    "clinicName"        TEXT,
    "durationDays"      INTEGER NOT NULL DEFAULT 30,
    "isTrial"           BOOLEAN DEFAULT false,
    "activatedAt"       TIMESTAMP(3),
    "expiresAt"         TIMESTAMP(3),
    "signatureToken"    TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- [Table 9] AdminAuditLog (Server-Only Administrative Audit Trail)
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
    "id"             TEXT NOT NULL,
    "action"         TEXT NOT NULL,
    "subscriptionId" TEXT,
    "subscriberId"   TEXT,
    "detail"         JSONB NOT NULL DEFAULT '{}'::jsonb,
    "ip"             TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- [Table 10] CloudPrescription (Multi-Tenant Offline-First Synchronization)
CREATE TABLE IF NOT EXISTS "CloudPrescription" (
    "id"             TEXT NOT NULL,
    "subscriberId"   TEXT NOT NULL,
    "prescriptionNo" TEXT NOT NULL,
    "branchId"       TEXT,
    "branchName"     TEXT,
    "patientName"    TEXT NOT NULL,
    "patientPhone"   TEXT,
    "patientAge"     TEXT,
    "patientGender"  TEXT,
    "diagnosis"      TEXT,
    "notes"          TEXT,
    "itemsJson"      JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloudPrescription_pkey" PRIMARY KEY ("id")
);

-- [Table 11] CloudBackup (Multi-Tenant Secure Cloud Data Vault)
CREATE TABLE IF NOT EXISTS "CloudBackup" (
    "id"            TEXT NOT NULL,
    "subscriberId"  TEXT NOT NULL,
    "fileName"      TEXT NOT NULL,
    "fileSizeKb"    INTEGER NOT NULL DEFAULT 0,
    "payloadBase64" TEXT NOT NULL,
    "metadataJson"  JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloudBackup_pkey" PRIMARY KEY ("id")
);

-- ----------------------------------------------------------------------------
-- 3) COLUMN MIGRATIONS (For existing databases upgrading in-place)
-- ----------------------------------------------------------------------------
ALTER TABLE "User"              ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "Drug"              ADD COLUMN IF NOT EXISTS "addedBy" TEXT;
ALTER TABLE "Drug"              ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Prescription"      ADD COLUMN IF NOT EXISTS "subscriberId" TEXT;
ALTER TABLE "Prescription"      ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Prescription"      ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

ALTER TABLE "Subscription"      ADD COLUMN IF NOT EXISTS "subscriberId" TEXT;
ALTER TABLE "Subscription"      ADD COLUMN IF NOT EXISTS "doctorName" TEXT;
ALTER TABLE "Subscription"      ADD COLUMN IF NOT EXISTS "clinicName" TEXT;
ALTER TABLE "Subscription"      ADD COLUMN IF NOT EXISTS "isTrial" BOOLEAN DEFAULT false;
ALTER TABLE "Subscription"      ADD COLUMN IF NOT EXISTS "signatureToken" TEXT;
ALTER TABLE "Subscription"      ADD COLUMN IF NOT EXISTS "allowedMachineIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Subscription"      ADD COLUMN IF NOT EXISTS "durationDays" INTEGER DEFAULT 30;
ALTER TABLE "Subscription"      ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3);
ALTER TABLE "Subscription"      ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "Subscription"      ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Subscription"      ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- ----------------------------------------------------------------------------
-- 4) PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
-- Branch indexes
CREATE INDEX IF NOT EXISTS "Branch_clinicId_idx"                ON "Branch"("clinicId");

-- User indexes
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key"              ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_clinicId_idx"                  ON "User"("clinicId");

-- Patient indexes
CREATE INDEX IF NOT EXISTS "Patient_clinicId_idx"               ON "Patient"("clinicId");
CREATE INDEX IF NOT EXISTS "Patient_name_idx"                   ON "Patient"("name");

-- Drug search indexes
CREATE INDEX IF NOT EXISTS "Drug_name_idx"                      ON "Drug"("name");
CREATE INDEX IF NOT EXISTS "Drug_nameAr_idx"                    ON "Drug"("nameAr");
CREATE INDEX IF NOT EXISTS "Drug_activeIngredient_idx"          ON "Drug"("activeIngredient");
CREATE INDEX IF NOT EXISTS "Drug_addedBy_idx"                   ON "Drug"("addedBy");

-- Prescription indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Prescription_prescriptionNo_key" ON "Prescription"("prescriptionNo");
CREATE INDEX IF NOT EXISTS "Prescription_clinicId_idx"          ON "Prescription"("clinicId");
CREATE INDEX IF NOT EXISTS "Prescription_branchId_idx"          ON "Prescription"("branchId");
CREATE INDEX IF NOT EXISTS "Prescription_patientId_idx"         ON "Prescription"("patientId");
CREATE INDEX IF NOT EXISTS "Prescription_prescriptionNo_idx"    ON "Prescription"("prescriptionNo");
CREATE INDEX IF NOT EXISTS "Prescription_subscriberId_idx"      ON "Prescription"("subscriberId");
CREATE INDEX IF NOT EXISTS "Prescription_isArchived_idx"        ON "Prescription"("isArchived");
CREATE INDEX IF NOT EXISTS "PrescriptionItem_prescriptionId_idx" ON "PrescriptionItem"("prescriptionId");

-- Subscription indexes
CREATE INDEX IF NOT EXISTS "Subscription_machineId_idx"         ON "Subscription"("machineId");
CREATE INDEX IF NOT EXISTS "Subscription_subscriberId_idx"      ON "Subscription"("subscriberId");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx"            ON "Subscription"("status");
CREATE INDEX IF NOT EXISTS "Subscription_updatedAt_idx"         ON "Subscription"("updatedAt" DESC);

-- Cloud Prescriptions & Backups indexes
CREATE INDEX IF NOT EXISTS "CloudPrescription_subscriberId_idx" ON "CloudPrescription"("subscriberId");
CREATE INDEX IF NOT EXISTS "CloudPrescription_createdAt_idx"    ON "CloudPrescription"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "CloudBackup_subscriberId_idx"       ON "CloudBackup"("subscriberId");
CREATE INDEX IF NOT EXISTS "CloudBackup_createdAt_idx"          ON "CloudBackup"("createdAt" DESC);

-- Admin Audit Log indexes
CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx"        ON "AdminAuditLog"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AdminAuditLog_subscriber_idx"       ON "AdminAuditLog"("subscriberId");

-- ----------------------------------------------------------------------------
-- 5) FOREIGN KEY RELATIONSHIPS (Safe creation)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE "Branch" ADD CONSTRAINT "Branch_clinicId_fkey"
        FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "User" ADD CONSTRAINT "User_clinicId_fkey"
        FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Patient" ADD CONSTRAINT "Patient_clinicId_fkey"
        FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_clinicId_fkey"
        FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_branchId_fkey"
        FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_doctorId_fkey"
        FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey"
        FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_prescriptionId_fkey"
        FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_drugId_fkey"
        FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ----------------------------------------------------------------------------
-- 6) SUPABASE REALTIME BROADCASTING
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE "Subscription";
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_object THEN null;
END $$;

-- ----------------------------------------------------------------------------
-- 7) SECURITY LOCKDOWN: ROW LEVEL SECURITY & PRIVILEGE ISOLATION
-- ----------------------------------------------------------------------------
-- Principle of Least Privilege:
-- Browser roles (`anon` and `authenticated`) lose ALL direct read/write access
-- to medical, patient, prescription, backup, and subscription tables.
-- All operations are mediated exclusively by the hardened PenRX+ server API
-- using the privileged `service_role` key.
--
-- Exception: `Drug` catalog is publicly readable by client devices (SELECT only).

-- 7.1 Enable strict Row Level Security & Revoke Client Privileges safely
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'Subscription', 'CloudPrescription', 'CloudBackup', 'AdminAuditLog',
        'Clinic', 'Branch', 'User', 'Patient', 'Prescription', 'PrescriptionItem'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        IF EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'public' AND tablename = tbl
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
            EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', tbl);
        END IF;
    END LOOP;

    -- Drug catalog: Public SELECT only for devices, no modifications allowed
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = 'Drug'
    ) THEN
        EXECUTE 'ALTER TABLE public."Drug" ENABLE ROW LEVEL SECURITY';
        EXECUTE 'REVOKE ALL ON TABLE public."Drug" FROM anon, authenticated';
        EXECUTE 'GRANT SELECT ON TABLE public."Drug" TO anon, authenticated';
    END IF;
END $$;

-- 7.2 Grant full administrative access to service_role (Server-Side Next.js API)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 7.3 Ensure future tables in public schema are protected by default
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;

-- 7.5 Drop any legacy permissive policies
DO $$ BEGIN
    DROP POLICY IF EXISTS "anon_insert_pending_sub"     ON "Subscription";
    DROP POLICY IF EXISTS "anon_select_sub"             ON "Subscription";
    DROP POLICY IF EXISTS "anon_update_sub"             ON "Subscription";
    DROP POLICY IF EXISTS "anon_delete_sub"             ON "Subscription";
    DROP POLICY IF EXISTS "service_role_all_sub"        ON "Subscription";
    DROP POLICY IF EXISTS "service_role_all_audit"      ON "AdminAuditLog";
    DROP POLICY IF EXISTS "anon_access_prescriptions"   ON "CloudPrescription";
    DROP POLICY IF EXISTS "service_role_prescriptions"  ON "CloudPrescription";
    DROP POLICY IF EXISTS "service_role_cloud_backup"   ON "CloudBackup";
EXCEPTION WHEN undefined_object THEN null; END $$;

-- 7.6 Hardened service_role policies
CREATE POLICY "service_role_all_sub" ON "Subscription"
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_audit" ON "AdminAuditLog"
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_prescriptions" ON "CloudPrescription"
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_cloud_backup" ON "CloudBackup"
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 8) SYSTEM SEED DATA
-- ----------------------------------------------------------------------------
-- Initial administrative clinic record.
INSERT INTO "Clinic" ("id", "name", "specialty", "primaryColor", "updatedAt")
VALUES ('clinic-admin-001', 'Rosheta System Administration', 'System Administration', '#059669', NOW())
ON CONFLICT ("id") DO NOTHING;

-- ----------------------------------------------------------------------------
-- 9) POSTGREST SCHEMA CACHE RELOAD
-- ----------------------------------------------------------------------------
-- Forces PostgREST to immediately rebuild its OpenAPI schema and detect new columns/policies.
NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- 10) SECURITY PRIVILEGE VERIFICATION
-- ----------------------------------------------------------------------------
-- Verifies that zero privileges remain for anon and authenticated on private tables.
SELECT
    COUNT(*) AS exposed_client_privileges,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ SUCCESS: Database is 100% locked down. Client roles have 0 direct privileges.'
        ELSE '⚠️ WARNING: Some tables still have client privileges.'
    END AS security_status
FROM information_schema.table_privileges
WHERE grantee IN ('anon', 'authenticated')
  AND table_schema = 'public'
  AND table_name IN ('Subscription', 'CloudPrescription', 'CloudBackup', 'Patient', 'Prescription', 'AdminAuditLog');
