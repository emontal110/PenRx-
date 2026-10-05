-- PostgreSQL Schema DDL for Rosheta Medical Platform (Supabase Compatible)

-- CreateEnum safely
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

-- CreateTable: Clinic
CREATE TABLE IF NOT EXISTS "Clinic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT NOT NULL DEFAULT 'General Medicine',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#059669',
    "headerText" TEXT,
    "footerText" TEXT,
    "showHeader" BOOLEAN NOT NULL DEFAULT true,
    "showFooter" BOOLEAN NOT NULL DEFAULT true,
    "notesTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Branch
CREATE TABLE IF NOT EXISTS "Branch" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "workingHours" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable: User
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DOCTOR',
    "title" TEXT NOT NULL DEFAULT 'Consultant',
    "syndicateId" TEXT,
    "phone" TEXT,
    "specialty" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Migration for existing database tables:
-- ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

-- CreateTable: Patient
CREATE TABLE IF NOT EXISTS "Patient" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "phone" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "bloodType" TEXT,
    "medicalHistory" TEXT,
    "allergyNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Drug
CREATE TABLE IF NOT EXISTS "Drug" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "activeIngredient" TEXT NOT NULL,
    "activeIngredientAr" TEXT,
    "company" TEXT,
    "price" DOUBLE PRECISION,
    "dosageForm" TEXT,
    "category" TEXT,
    "isControlled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Drug_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Prescription
CREATE TABLE IF NOT EXISTS "Prescription" (
    "id" TEXT NOT NULL,
    "prescriptionNo" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "diagnosis" TEXT,
    "notes" TEXT,
    "paperSize" "PaperSize" NOT NULL DEFAULT 'A4',
    "qrCodeUrl" TEXT,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PrescriptionItem
CREATE TABLE IF NOT EXISTS "PrescriptionItem" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "drugId" TEXT,
    "drugName" TEXT NOT NULL,
    "activeIngredient" TEXT,
    "doseQuantity" TEXT NOT NULL,
    "doseForm" TEXT,
    "frequency" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "instructions" TEXT,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PrescriptionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Branch_clinicId_idx" ON "Branch"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_clinicId_idx" ON "User"("clinicId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Patient_clinicId_idx" ON "Patient"("clinicId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Patient_name_idx" ON "Patient"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Drug_name_idx" ON "Drug"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Drug_nameAr_idx" ON "Drug"("nameAr");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Drug_activeIngredient_idx" ON "Drug"("activeIngredient");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Prescription_prescriptionNo_key" ON "Prescription"("prescriptionNo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Prescription_clinicId_idx" ON "Prescription"("clinicId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Prescription_branchId_idx" ON "Prescription"("branchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Prescription_patientId_idx" ON "Prescription"("patientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Prescription_prescriptionNo_idx" ON "Prescription"("prescriptionNo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PrescriptionItem_prescriptionId_idx" ON "PrescriptionItem"("prescriptionId");

-- AddForeignKey (Safely)
DO $$ BEGIN
    ALTER TABLE "Branch" ADD CONSTRAINT "Branch_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "User" ADD CONSTRAINT "User_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Patient" ADD CONSTRAINT "Patient_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Ensure passwordHash column exists on existing database tables
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

-- CreateTable: Subscription
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT,
    "planId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMethod" TEXT NOT NULL DEFAULT 'vodafone',
    "senderPhone" TEXT NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "machineId" TEXT NOT NULL,
    "allowedMachineIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "doctorName" TEXT,
    "clinicName" TEXT,
    "durationDays" INTEGER NOT NULL DEFAULT 30,
    "isTrial" BOOLEAN DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "signatureToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- Ensure subscriberId, doctorName, clinicName, isTrial, signatureToken and allowedMachineIds columns exist on existing Subscription table in Supabase
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "subscriberId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "doctorName" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "clinicName" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "isTrial" BOOLEAN DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "signatureToken" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "allowedMachineIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Indexes on Subscription (Safe after column existence check)
CREATE INDEX IF NOT EXISTS "Subscription_machineId_idx" ON "Subscription"("machineId");
CREATE INDEX IF NOT EXISTS "Subscription_subscriberId_idx" ON "Subscription"("subscriberId");

-- =========================================================================
-- Security Hardening: Enable Strict Row Level Security (RLS) on Subscription
-- =========================================================================
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;

-- Drop legacy/insecure policies if exist
DO $$ BEGIN
    DROP POLICY IF EXISTS "anon_insert_pending_sub" ON "Subscription";
    DROP POLICY IF EXISTS "anon_select_sub" ON "Subscription";
    DROP POLICY IF EXISTS "service_role_all_sub" ON "Subscription";
EXCEPTION WHEN undefined_object THEN null; END $$;

-- 1. Anonymous users can ONLY insert new subscription requests in PENDING status
CREATE POLICY "anon_insert_pending_sub" ON "Subscription"
    FOR INSERT
    TO anon, authenticated
    WITH CHECK ("status" = 'PENDING');

-- 2. Anonymous/doctor instances can only query subscriptions for verification
CREATE POLICY "anon_select_sub" ON "Subscription"
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- 3. Strictly BLOCK any anonymous UPDATE or DELETE.
-- Updates and deletions are exclusively reserved for service_role or server-side API.
CREATE POLICY "service_role_all_sub" ON "Subscription"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =========================================================================
-- Table for Cloud Synchronization of Prescriptions (Multi-Tenant)
-- =========================================================================
CREATE TABLE IF NOT EXISTS "CloudPrescription" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "prescriptionNo" TEXT NOT NULL,
    "branchId" TEXT,
    "branchName" TEXT,
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT,
    "patientAge" TEXT,
    "patientGender" TEXT,
    "diagnosis" TEXT,
    "notes" TEXT,
    "itemsJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloudPrescription_pkey" PRIMARY KEY ("id")
);

-- Fast lookup indexes partitioned by subscriber and date
CREATE INDEX IF NOT EXISTS "CloudPrescription_subscriberId_idx" ON "CloudPrescription"("subscriberId");
CREATE INDEX IF NOT EXISTS "CloudPrescription_createdAt_idx" ON "CloudPrescription"("createdAt");

-- =========================================================================
-- Security Hardening: Enable Strict Row Level Security (RLS) on CloudPrescription
-- =========================================================================
ALTER TABLE "CloudPrescription" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "anon_access_prescriptions" ON "CloudPrescription";
    DROP POLICY IF EXISTS "service_role_prescriptions" ON "CloudPrescription";
EXCEPTION WHEN undefined_object THEN null; END $$;

-- Anonymous direct SELECT/DELETE is blocked. Sync is brokered via authenticated server API or service_role
CREATE POLICY "service_role_prescriptions" ON "CloudPrescription"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


-- Seed Admin User and System Clinic in Database
INSERT INTO "Clinic" ("id", "name", "specialty", "primaryColor", "updatedAt")
VALUES ('clinic-admin-001', 'Rosheta System Administration', 'System Administration', '#059669', NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "User" ("id", "clinicId", "name", "email", "role", "title", "passwordHash", "updatedAt")
VALUES (
    'user-admin-001',
    'clinic-admin-001',
    'Rosheta System Administrator',
    'emontal.33@gmail.com',
    'ADMIN',
    'System Admin',
    'd864f9ef7a371d39f5ae82167cd1add8baf1422e5b70b6e2b16a5efc92cac61b0f36f00773f3fa6e01755d0382d3df27aa84b5316e87e5b7ce02cac9677a5a7e',
    NOW()
)
ON CONFLICT ("email") DO UPDATE SET
    "role" = 'ADMIN',
    "passwordHash" = 'd864f9ef7a371d39f5ae82167cd1add8baf1422e5b70b6e2b16a5efc92cac61b0f36f00773f3fa6e01755d0382d3df27aa84b5316e87e5b7ce02cac9677a5a7e';

-- =========================================================================
-- Table for Multi-Tenant Secure Cloud Backups (Partitioned by subscriberId)
-- =========================================================================
CREATE TABLE IF NOT EXISTS "CloudBackup" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSizeKb" INTEGER NOT NULL DEFAULT 0,
    "payloadBase64" TEXT NOT NULL,
    "metadataJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloudBackup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CloudBackup_subscriberId_idx" ON "CloudBackup"("subscriberId");
CREATE INDEX IF NOT EXISTS "CloudBackup_createdAt_idx" ON "CloudBackup"("createdAt");

ALTER TABLE "CloudBackup" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_cloud_backup" ON "CloudBackup"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

