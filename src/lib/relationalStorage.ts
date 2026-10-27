import { SavedPrescription } from "@/store/usePrescriptionStore";
import { supabaseRest } from "@/lib/supabaseRest";

export interface ClinicMetaInfo {
  name?: string;
  doctorName?: string;
  specialty?: string;
  phone?: string;
  address?: string;
}

/**
 * Relational mirror of the prescription (Clinic -> Branch -> User -> Patient ->
 * Prescription -> PrescriptionItems). Only reachable from server route handlers
 * and only when ENABLE_RELATIONAL_DUAL_WRITE=true; access is env-keyed, never
 * sourced from code.
 */

async function listRow<T = any>(table: string, query: string): Promise<T[]> {
  try {
    const rows = await supabaseRest<T[]>(table, { query });
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function firstOrCreate(table: string, query: string, row: any, fallbackId: string): Promise<string> {
  const existing = await listRow(table, query);
  if (existing.length > 0) return String(existing[0].id);
  try {
    const created = await supabaseRest(table, {
      method: "POST",
      body: row,
      prefer: "return=representation",
    });
    const list = Array.isArray(created) ? created : [];
    return list[0]?.id ? String(list[0].id) : fallbackId;
  } catch {
    return fallbackId;
  }
}

export async function savePrescriptionRelational(
  rx: SavedPrescription,
  clinicData?: ClinicMetaInfo,
  subscriberId?: string
) {
  const now = new Date().toISOString();

  const clinicId = await firstOrCreate(
    "Clinic",
    "limit=1",
    {
      id: "clinic-default",
      name:
        clinicData?.name ||
        (clinicData?.doctorName ? `عيادة د. ${clinicData.doctorName}` : "عيادة PenRX+ الطبية"),
      specialty: clinicData?.specialty || "طب عام واستشارات",
      headerText: clinicData?.name || null,
      footerText: clinicData?.phone || null,
      updatedAt: now,
    },
    "clinic-default"
  );

  const branchId = await firstOrCreate(
    "Branch",
    `clinicId=eq.${encodeURIComponent(clinicId)}&limit=1`,
    {
      id: "branch-default",
      clinicId,
      name: rx.branchName || "الفرع الرئيسي",
      address: clinicData?.address || "العيادة الرئيسية",
      phone: clinicData?.phone || null,
      isDefault: true,
      updatedAt: now,
    },
    "branch-default"
  );

  const doctorId = await firstOrCreate(
    "User",
    `clinicId=eq.${encodeURIComponent(clinicId)}&role=eq.DOCTOR&limit=1`,
    {
      id: "doctor-default",
      clinicId,
      name: clinicData?.doctorName || "طبيب العيادة",
      email: `doctor-${clinicId.slice(0, 8)}@penrx.local`,
      role: "DOCTOR",
      specialty: clinicData?.specialty || "استشاري",
      updatedAt: now,
    },
    "doctor-default"
  );

  const patientName = (rx.patient.name || "مريض بدون اسم").trim();
  const patientPhone = (rx.patient.phone || "").trim();
  const patientQuery = patientPhone
    ? `clinicId=eq.${encodeURIComponent(clinicId)}&phone=eq.${encodeURIComponent(patientPhone)}&limit=1`
    : `clinicId=eq.${encodeURIComponent(clinicId)}&name=eq.${encodeURIComponent(patientName)}&limit=1`;

  const patientId = await firstOrCreate(
    "Patient",
    patientQuery,
    {
      id: `patient-${Date.now()}`,
      clinicId,
      name: patientName,
      phone: patientPhone || null,
      age: rx.patient.age ? parseInt(String(rx.patient.age), 10) || null : null,
      gender: rx.patient.gender || null,
      updatedAt: now,
    },
    `patient-${Date.now()}`
  );

  const prescriptionRecord = {
    id: rx.id,
    prescriptionNo: rx.prescriptionNo,
    clinicId,
    branchId,
    doctorId,
    patientId,
    diagnosis: rx.diagnosis || null,
    notes: rx.notes || null,
    isArchived: Boolean(rx.isArchived),
    archivedAt: rx.archivedAt ? new Date(rx.archivedAt).toISOString() : null,
    subscriberId: subscriberId || null,
    createdAt: new Date(rx.createdAt || Date.now()).toISOString(),
    updatedAt: now,
  };

  await supabaseRest("Prescription", {
    method: "POST",
    query: "on_conflict=id",
    body: prescriptionRecord,
    prefer: "resolution=merge-duplicates,return=minimal",
  });

  if (Array.isArray(rx.items) && rx.items.length > 0) {
    await supabaseRest("PrescriptionItem", {
      method: "DELETE",
      query: `prescriptionId=eq.${encodeURIComponent(rx.id)}`,
    }).catch(() => null);

    await supabaseRest("PrescriptionItem", {
      method: "POST",
      prefer: "return=minimal",
      body: rx.items.map((it, idx) => ({
        id: `item-${rx.id}-${idx}`,
        prescriptionId: rx.id,
        drugName: it.drugName,
        activeIngredient: it.activeIngredient || null,
        doseQuantity: it.doseQuantity || "1",
        doseForm: it.doseForm || null,
        frequency: it.frequency || "",
        duration: it.duration || "",
        instructions: it.instructions || null,
        sortOrder: idx,
      })),
    });
  }

  return prescriptionRecord;
}

/** Deletes a prescription (items cascade) from the relational tables. */
export async function deletePrescriptionRelational(prescriptionIdOrNo: string): Promise<boolean> {
  const scoped = `or=(id.eq.${encodeURIComponent(prescriptionIdOrNo)},prescriptionNo.eq.${encodeURIComponent(prescriptionIdOrNo)})`;
  try {
    await supabaseRest("Prescription", { method: "DELETE", query: scoped });
    return true;
  } catch (err: any) {
    console.warn("[RelationalStorage] Delete notice:", err?.message || err);
    return false;
  }
}

/** Archives or un-archives a prescription in the relational tables. */
export async function setPrescriptionArchiveStatus(
  prescriptionIdOrNo: string,
  isArchived: boolean
): Promise<boolean> {
  const scoped = `or=(id.eq.${encodeURIComponent(prescriptionIdOrNo)},prescriptionNo.eq.${encodeURIComponent(prescriptionIdOrNo)})`;
  try {
    await supabaseRest("Prescription", {
      method: "PATCH",
      query: scoped,
      body: {
        isArchived,
        archivedAt: isArchived ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      },
    });
    return true;
  } catch (err: any) {
    console.warn("[RelationalStorage] Archive notice:", err?.message || err);
    return false;
  }
}
