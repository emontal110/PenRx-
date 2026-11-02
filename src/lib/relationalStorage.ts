import { SavedPrescription } from "@/store/usePrescriptionStore";
import { supabaseRest } from "@/lib/supabaseRest";

export interface ClinicMetaInfo {
  name?: string;
  doctorName?: string;
  specialty?: string;
  phone?: string;
  address?: string;
}

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
  const cleanSub = (subscriberId || "default").replace(/[^a-zA-Z0-9_-]/g, "");
  const tenantClinicId = `clinic-${cleanSub}`;
  const tenantBranchId = `branch-${cleanSub}`;
  const tenantDoctorId = `doctor-${cleanSub}`;

  const clinicId = await firstOrCreate(
    "Clinic",
    `id=eq.${encodeURIComponent(tenantClinicId)}&limit=1`,
    {
      id: tenantClinicId,
      name:
        clinicData?.name ||
        (clinicData?.doctorName ? `عيادة د. ${clinicData.doctorName}` : `عيادة المشترك ${cleanSub}`),
      specialty: clinicData?.specialty || "طب عام واستشارات",
      headerText: clinicData?.name || null,
      footerText: clinicData?.phone || null,
      updatedAt: now,
    },
    tenantClinicId
  );

  const branchId = await firstOrCreate(
    "Branch",
    `clinicId=eq.${encodeURIComponent(clinicId)}&limit=1`,
    {
      id: tenantBranchId,
      clinicId,
      name: rx.branchName || "الفرع الرئيسي",
      address: clinicData?.address || "العيادة الرئيسية",
      phone: clinicData?.phone || "01000000000",
      isDefault: true,
      updatedAt: now,
    },
    tenantBranchId
  );

  const doctorId = await firstOrCreate(
    "User",
    `clinicId=eq.${encodeURIComponent(clinicId)}&role=eq.DOCTOR&limit=1`,
    {
      id: tenantDoctorId,
      clinicId,
      name: clinicData?.doctorName || "طبيب العيادة",
      email: `doctor-${cleanSub.toLowerCase()}@penrx.local`,
      role: "DOCTOR",
      specialty: clinicData?.specialty || "استشاري",
      updatedAt: now,
    },
    tenantDoctorId
  );

  const patientName = (rx.patient.name || "مريض بدون اسم").trim();
  const patientPhone = (rx.patient.phone || "").trim();
  const patientQuery = patientPhone
    ? `clinicId=eq.${encodeURIComponent(clinicId)}&phone=eq.${encodeURIComponent(patientPhone)}&limit=1`
    : `clinicId=eq.${encodeURIComponent(clinicId)}&name=eq.${encodeURIComponent(patientName)}&limit=1`;

  const fallbackPatId = `patient-${cleanSub}-${Date.now()}`;
  const patientId = await firstOrCreate(
    "Patient",
    patientQuery,
    {
      id: fallbackPatId,
      clinicId,
      name: patientName,
      phone: patientPhone || null,
      age: rx.patient.age ? parseInt(String(rx.patient.age), 10) || null : null,
      gender: rx.patient.gender || null,
      updatedAt: now,
    },
    fallbackPatId
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

/** Deletes a prescription (items cascade) from the relational tables, strictly tenant-scoped. */
export async function deletePrescriptionRelational(
  prescriptionIdOrNo: string,
  subscriberId?: string
): Promise<boolean> {
  const baseScope = `or=(id.eq.${encodeURIComponent(prescriptionIdOrNo)},prescriptionNo.eq.${encodeURIComponent(prescriptionIdOrNo)})`;
  const scoped = subscriberId
    ? `${baseScope}&subscriberId=eq.${encodeURIComponent(subscriberId)}`
    : baseScope;
  try {
    await supabaseRest("Prescription", { method: "DELETE", query: scoped });
    return true;
  } catch (err: any) {
    console.warn("[RelationalStorage] Delete notice:", err?.message || err);
    return false;
  }
}

/** Archives or un-archives a prescription in the relational tables, strictly tenant-scoped. */
export async function setPrescriptionArchiveStatus(
  prescriptionIdOrNo: string,
  isArchived: boolean,
  subscriberId?: string
): Promise<boolean> {
  const baseScope = `or=(id.eq.${encodeURIComponent(prescriptionIdOrNo)},prescriptionNo.eq.${encodeURIComponent(prescriptionIdOrNo)})`;
  const scoped = subscriberId
    ? `${baseScope}&subscriberId=eq.${encodeURIComponent(subscriberId)}`
    : baseScope;
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
