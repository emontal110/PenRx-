import { SavedPrescription } from "@/store/usePrescriptionStore";

export interface ClinicMetaInfo {
  name?: string;
  doctorName?: string;
  specialty?: string;
  phone?: string;
  address?: string;
}

const SUPABASE_REST_URL = "https://qspaigplwyvpqbmszpgc.supabase.co/rest/v1";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzcGFpZ3Bsd3l2cHFibXN6cGdjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTU5MDU0MywiZXhwIjoyMTA1MTY2NTQzfQ.gJ9ArhmjkAf2tQmqZbvA88hJmDaz6EYgf2RdJfl6RCE";

const supabaseHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

/**
 * Saves or updates a prescription in real relational Supabase tables:
 * Clinic -> Branch -> User (Doctor) -> Patient -> Prescription -> PrescriptionItems
 */
export async function savePrescriptionRelational(
  rx: SavedPrescription,
  clinicData?: ClinicMetaInfo,
  subscriberId?: string
) {
  try {
    // 1. Ensure Clinic exists or upsert default clinic via Supabase REST
    let clinicId = "clinic-default";
    try {
      const cRes = await fetch(`${SUPABASE_REST_URL}/Clinic?limit=1`, {
        headers: supabaseHeaders,
        signal: AbortSignal.timeout(2000),
      });
      if (cRes.ok) {
        const clinics = await cRes.json();
        if (Array.isArray(clinics) && clinics.length > 0) {
          clinicId = clinics[0].id;
        } else {
          const createRes = await fetch(`${SUPABASE_REST_URL}/Clinic`, {
            method: "POST",
            headers: { ...supabaseHeaders, Prefer: "return=representation" },
            body: JSON.stringify({
              id: "clinic-default",
              name: clinicData?.name || (clinicData?.doctorName ? `عيادة د. ${clinicData.doctorName}` : "عيادة PenRX+ الطبية"),
              specialty: clinicData?.specialty || "طب عام واستشارات",
              headerText: clinicData?.name || null,
              footerText: clinicData?.phone || null,
              updatedAt: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(2000),
          });
          if (createRes.ok) {
            const created = await createRes.json();
            if (Array.isArray(created) && created[0]) clinicId = created[0].id;
          }
        }
      }
    } catch {}

    // 2. Ensure Branch exists
    let branchId = "branch-default";
    try {
      const bRes = await fetch(`${SUPABASE_REST_URL}/Branch?clinicId=eq.${encodeURIComponent(clinicId)}&limit=1`, {
        headers: supabaseHeaders,
        signal: AbortSignal.timeout(2000),
      });
      if (bRes.ok) {
        const branches = await bRes.json();
        if (Array.isArray(branches) && branches.length > 0) {
          branchId = branches[0].id;
        } else {
          const createRes = await fetch(`${SUPABASE_REST_URL}/Branch`, {
            method: "POST",
            headers: { ...supabaseHeaders, Prefer: "return=representation" },
            body: JSON.stringify({
              id: "branch-default",
              clinicId,
              name: rx.branchName || "الفرع الرئيسي",
              address: clinicData?.address || "العيادة الرئيسية",
              phone: clinicData?.phone || "01000000000",
              isDefault: true,
              updatedAt: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(2000),
          });
          if (createRes.ok) {
            const created = await createRes.json();
            if (Array.isArray(created) && created[0]) branchId = created[0].id;
          }
        }
      }
    } catch {}

    // 3. Ensure Doctor User exists
    let doctorId = "doctor-default";
    try {
      const dRes = await fetch(`${SUPABASE_REST_URL}/User?clinicId=eq.${encodeURIComponent(clinicId)}&role=eq.DOCTOR&limit=1`, {
        headers: supabaseHeaders,
        signal: AbortSignal.timeout(2000),
      });
      if (dRes.ok) {
        const users = await dRes.json();
        if (Array.isArray(users) && users.length > 0) {
          doctorId = users[0].id;
        } else {
          const createRes = await fetch(`${SUPABASE_REST_URL}/User`, {
            method: "POST",
            headers: { ...supabaseHeaders, Prefer: "return=representation" },
            body: JSON.stringify({
              id: "doctor-default",
              clinicId,
              name: clinicData?.doctorName || "طبيب العيادة",
              email: `doctor-${clinicId.substring(0, 8)}@penrx.local`,
              role: "DOCTOR",
              specialty: clinicData?.specialty || "استشاري",
              updatedAt: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(2000),
          });
          if (createRes.ok) {
            const created = await createRes.json();
            if (Array.isArray(created) && created[0]) doctorId = created[0].id;
          }
        }
      }
    } catch {}

    // 4. Find or Create Patient
    let patientId = `patient-${Date.now()}`;
    const patientName = (rx.patient.name || "مريض بدون اسم").trim();
    const cleanPhone = (rx.patient.phone || "").trim();

    try {
      const pQuery = cleanPhone
        ? `${SUPABASE_REST_URL}/Patient?clinicId=eq.${encodeURIComponent(clinicId)}&phone=eq.${encodeURIComponent(cleanPhone)}&limit=1`
        : `${SUPABASE_REST_URL}/Patient?clinicId=eq.${encodeURIComponent(clinicId)}&name=eq.${encodeURIComponent(patientName)}&limit=1`;
      const pRes = await fetch(pQuery, { headers: supabaseHeaders, signal: AbortSignal.timeout(2000) });
      if (pRes.ok) {
        const patients = await pRes.json();
        if (Array.isArray(patients) && patients.length > 0) {
          patientId = patients[0].id;
        } else {
          const createRes = await fetch(`${SUPABASE_REST_URL}/Patient`, {
            method: "POST",
            headers: { ...supabaseHeaders, Prefer: "return=representation" },
            body: JSON.stringify({
              id: patientId,
              clinicId,
              name: patientName,
              phone: cleanPhone || null,
              age: rx.patient.age ? parseInt(String(rx.patient.age)) || null : null,
              gender: rx.patient.gender || null,
              updatedAt: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(2000),
          });
          if (createRes.ok) {
            const created = await createRes.json();
            if (Array.isArray(created) && created[0]) patientId = created[0].id;
          }
        }
      }
    } catch {}

    // 5. Upsert Prescription
    const rxDate = new Date(rx.createdAt || Date.now()).toISOString();
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
      createdAt: rxDate,
      updatedAt: new Date().toISOString(),
    };

    try {
      await fetch(`${SUPABASE_REST_URL}/Prescription`, {
        method: "POST",
        headers: {
          ...supabaseHeaders,
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify(prescriptionRecord),
        signal: AbortSignal.timeout(2500),
      });
    } catch {}

    // 6. Replace Prescription Items
    if (Array.isArray(rx.items) && rx.items.length > 0) {
      try {
        await fetch(`${SUPABASE_REST_URL}/PrescriptionItem?prescriptionId=eq.${encodeURIComponent(rx.id)}`, {
          method: "DELETE",
          headers: supabaseHeaders,
          signal: AbortSignal.timeout(2000),
        });

        const itemsPayload = rx.items.map((it, idx) => ({
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
        }));

        await fetch(`${SUPABASE_REST_URL}/PrescriptionItem`, {
          method: "POST",
          headers: supabaseHeaders,
          body: JSON.stringify(itemsPayload),
          signal: AbortSignal.timeout(2500),
        });
      } catch {}
    }

    return prescriptionRecord;
  } catch (err: any) {
    console.warn("[RelationalStorage] Notice: Supabase relational persist deferred:", err.message);
    return null;
  }
}

/**
 * Delete a prescription and its items from relational tables in Supabase
 */
export async function deletePrescriptionRelational(prescriptionIdOrNo: string): Promise<boolean> {
  try {
    await fetch(
      `${SUPABASE_REST_URL}/Prescription?or=(id.eq.${encodeURIComponent(prescriptionIdOrNo)},prescriptionNo.eq.${encodeURIComponent(prescriptionIdOrNo)})`,
      {
        method: "DELETE",
        headers: supabaseHeaders,
        signal: AbortSignal.timeout(2500),
      }
    );
    return true;
  } catch (err: any) {
    console.warn("[RelationalStorage] Delete notice:", err.message);
    return false;
  }
}

/**
 * Archive a prescription in relational Supabase database
 */
export async function setPrescriptionArchiveStatus(
  prescriptionIdOrNo: string,
  isArchived: boolean
): Promise<boolean> {
  try {
    await fetch(
      `${SUPABASE_REST_URL}/Prescription?or=(id.eq.${encodeURIComponent(prescriptionIdOrNo)},prescriptionNo.eq.${encodeURIComponent(prescriptionIdOrNo)})`,
      {
        method: "PATCH",
        headers: supabaseHeaders,
        body: JSON.stringify({
          isArchived,
          archivedAt: isArchived ? new Date().toISOString() : null,
          updatedAt: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(2500),
      }
    );
    return true;
  } catch (err: any) {
    console.warn("[RelationalStorage] Archive notice:", err.message);
    return false;
  }
}
