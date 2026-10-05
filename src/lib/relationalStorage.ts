import { prisma } from "@/lib/prisma";
import { SavedPrescription } from "@/store/usePrescriptionStore";

export interface ClinicMetaInfo {
  name?: string;
  doctorName?: string;
  specialty?: string;
  phone?: string;
  address?: string;
}

/**
 * Saves or updates a prescription in real relational Prisma tables:
 * Clinic -> Branch -> User (Doctor) -> Patient -> Prescription -> PrescriptionItems
 */
export async function savePrescriptionRelational(
  rx: SavedPrescription,
  clinicData?: ClinicMetaInfo,
  subscriberId?: string
) {
  try {
    // 1. Ensure Clinic exists or upsert default clinic
    let clinic = await prisma.clinic.findFirst();
    if (!clinic) {
      clinic = await prisma.clinic.create({
        data: {
          name: clinicData?.name || (clinicData?.doctorName ? `عيادة د. ${clinicData.doctorName}` : "عيادة PenRX+ الطبية"),
          specialty: clinicData?.specialty || "طب عام واستشارات",
          headerText: clinicData?.name || null,
          footerText: clinicData?.phone || null,
        },
      });
    }

    // 2. Ensure Branch exists
    let branch = await prisma.branch.findFirst({
      where: { clinicId: clinic.id },
    });
    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          clinicId: clinic.id,
          name: rx.branchName || "الفرع الرئيسي",
          address: clinicData?.address || "العيادة الرئيسية",
          phone: clinicData?.phone || "01000000000",
          isDefault: true,
        },
      });
    }

    // 3. Ensure Doctor User exists
    let doctor = await prisma.user.findFirst({
      where: { clinicId: clinic.id, role: "DOCTOR" },
    });
    if (!doctor) {
      const email = `doctor-${clinic.id.substring(0, 8)}@penrx.local`;
      doctor = await prisma.user.create({
        data: {
          clinicId: clinic.id,
          name: clinicData?.doctorName || "طبيب العيادة",
          email,
          role: "DOCTOR",
          specialty: clinicData?.specialty || "استشاري",
        },
      });
    }

    // 4. Find or Create Patient
    let patient = null;
    const patientName = (rx.patient.name || "مريض بدون اسم").trim();
    const cleanPhone = (rx.patient.phone || "").trim();

    if (cleanPhone) {
      patient = await prisma.patient.findFirst({
        where: { clinicId: clinic.id, phone: cleanPhone },
      });
    }
    if (!patient) {
      patient = await prisma.patient.findFirst({
        where: { clinicId: clinic.id, name: patientName },
      });
    }
    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          clinicId: clinic.id,
          name: patientName,
          phone: cleanPhone || null,
          age: rx.patient.age ? parseInt(String(rx.patient.age)) || null : null,
          gender: rx.patient.gender || null,
        },
      });
    } else {
      await prisma.patient.update({
        where: { id: patient.id },
        data: {
          age: rx.patient.age ? parseInt(String(rx.patient.age)) || patient.age : patient.age,
          gender: rx.patient.gender || patient.gender,
          phone: cleanPhone || patient.phone,
        },
      });
    }

    // 5. Upsert Prescription
    const rxDate = new Date(rx.createdAt || Date.now());
    const prescription = await prisma.prescription.upsert({
      where: { prescriptionNo: rx.prescriptionNo },
      update: {
        diagnosis: rx.diagnosis || null,
        notes: rx.notes || null,
        isArchived: Boolean(rx.isArchived),
        archivedAt: rx.archivedAt ? new Date(rx.archivedAt) : null,
        subscriberId: subscriberId || null,
        updatedAt: new Date(),
      },
      create: {
        id: rx.id,
        prescriptionNo: rx.prescriptionNo,
        clinicId: clinic.id,
        branchId: branch.id,
        doctorId: doctor.id,
        patientId: patient.id,
        diagnosis: rx.diagnosis || null,
        notes: rx.notes || null,
        isArchived: Boolean(rx.isArchived),
        archivedAt: rx.archivedAt ? new Date(rx.archivedAt) : null,
        subscriberId: subscriberId || null,
        createdAt: rxDate,
        updatedAt: new Date(),
      },
    });

    // 6. Replace Prescription Items
    await prisma.prescriptionItem.deleteMany({
      where: { prescriptionId: prescription.id },
    });

    if (Array.isArray(rx.items) && rx.items.length > 0) {
      await prisma.prescriptionItem.createMany({
        data: rx.items.map((it, idx) => ({
          prescriptionId: prescription.id,
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

    return prescription;
  } catch (err: any) {
    console.warn("[RelationalStorage] Notice: Prisma DB persist deferred:", err.message);
    return null;
  }
}

/**
 * Delete a prescription and its items from relational tables
 */
export async function deletePrescriptionRelational(prescriptionIdOrNo: string) {
  try {
    const rx = await prisma.prescription.findFirst({
      where: {
        OR: [{ id: prescriptionIdOrNo }, { prescriptionNo: prescriptionIdOrNo }],
      },
    });
    if (rx) {
      await prisma.prescription.delete({ where: { id: rx.id } });
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn("[RelationalStorage] Delete notice:", err.message);
    return false;
  }
}

/**
 * Archive a prescription in relational database
 */
export async function setPrescriptionArchiveStatus(
  prescriptionIdOrNo: string,
  isArchived: boolean
) {
  try {
    const rx = await prisma.prescription.findFirst({
      where: {
        OR: [{ id: prescriptionIdOrNo }, { prescriptionNo: prescriptionIdOrNo }],
      },
    });
    if (rx) {
      await prisma.prescription.update({
        where: { id: rx.id },
        data: {
          isArchived,
          archivedAt: isArchived ? new Date() : null,
          updatedAt: new Date(),
        },
      });
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn("[RelationalStorage] Archive notice:", err.message);
    return false;
  }
}
