import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface PrescriptionItem {
  id: string;
  drugId?: string;
  drugName: string;
  activeIngredient?: string;
  doseQuantity: string;
  doseForm: string;
  frequency: string;
  duration: string;
  instructions?: string;
  isCustom?: boolean;
}

export interface PatientInfo {
  id?: string;
  name: string;
  age?: number | string;
  gender?: "MALE" | "FEMALE";
  phone?: string;
  bloodType?: string;
  allergyNotes?: string;
  medicalHistory?: string;
}

export interface SavedPrescription {
  id: string;
  prescriptionNo: string;
  createdAt: string;
  patient: PatientInfo;
  branchId: string;
  branchName?: string;
  diagnosis?: string;
  notes?: string;
  items: PrescriptionItem[];
}

interface PrescriptionStoreState {
  prescriptionNo: string;
  patient: PatientInfo;
  diagnosis: string;
  notes: string;
  items: PrescriptionItem[];
  selectedBranchId: string;
  savedPrescriptions: SavedPrescription[];
  savedPatients: PatientInfo[];

  setPatient: (patient: Partial<PatientInfo>) => void;
  setDiagnosis: (diag: string) => void;
  setNotes: (notes: string) => void;
  setSelectedBranchId: (id: string) => void;

  addItem: (item: Omit<PrescriptionItem, "id">) => void;
  updateItem: (id: string, updates: Partial<PrescriptionItem>) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
  resetCurrentPrescription: () => void;

  savePrescription: (branchName?: string) => SavedPrescription;
  deleteSavedPrescription: (id: string) => void;
  loadPrescriptionToEdit: (prescription: SavedPrescription) => void;
}

function generatePrescriptionNo(): string {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PRX-${dateStr}-${rand}`;
}

export const usePrescriptionStore = create<PrescriptionStoreState>()(
  persist(
    (set, get) => ({
      prescriptionNo: generatePrescriptionNo(),
      patient: {
        name: "",
        age: "",
        gender: "MALE",
        phone: "",
        allergyNotes: "",
      },
      diagnosis: "",
      notes: "",
      items: [],
      selectedBranchId: "branch-01",
      savedPrescriptions: [],
      savedPatients: [],

      setPatient: (updated) =>
        set((state) => ({ patient: { ...state.patient, ...updated } })),

      setDiagnosis: (diagnosis) => set({ diagnosis }),
      setNotes: (notes) => set({ notes }),
      setSelectedBranchId: (selectedBranchId) => set({ selectedBranchId }),

      addItem: (itemData) => {
        const newItem: PrescriptionItem = {
          ...itemData,
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        };
        set((state) => ({ items: [...state.items, newItem] }));
      },

      updateItem: (id, updates) =>
        set((state) => ({
          items: state.items.map((it) => (it.id === id ? { ...it, ...updates } : it)),
        })),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((it) => it.id !== id),
        })),

      clearItems: () => set({ items: [] }),

      resetCurrentPrescription: () =>
        set({
          prescriptionNo: generatePrescriptionNo(),
          patient: { name: "", age: "", gender: "MALE", phone: "", allergyNotes: "" },
          diagnosis: "",
          notes: "",
          items: [],
        }),

      savePrescription: (branchName) => {
        const state = get();
        const newRecord: SavedPrescription = {
          id: `rx-${Date.now()}`,
          prescriptionNo: state.prescriptionNo,
          createdAt: new Date().toISOString(),
          patient: state.patient,
          branchId: state.selectedBranchId,
          branchName: branchName || "الفرع الرئيسي",
          diagnosis: state.diagnosis,
          notes: state.notes,
          items: [...state.items],
        };

        // Also add or update patient in patient directory
        const existingPatientIndex = state.savedPatients.findIndex(
          (p) => (p.phone && p.phone === state.patient.phone) || p.name.trim().toLowerCase() === state.patient.name.trim().toLowerCase()
        );

        let updatedPatients = [...state.savedPatients];
        if (existingPatientIndex >= 0) {
          updatedPatients[existingPatientIndex] = { ...updatedPatients[existingPatientIndex], ...state.patient };
        } else if (state.patient.name.trim()) {
          updatedPatients.unshift({ ...state.patient, id: `pat-${Date.now()}` });
        }

        set({
          savedPrescriptions: [newRecord, ...state.savedPrescriptions],
          savedPatients: updatedPatients,
        });

        return newRecord;
      },

      deleteSavedPrescription: (id) =>
        set((state) => ({
          savedPrescriptions: state.savedPrescriptions.filter((rx) => rx.id !== id),
        })),

      loadPrescriptionToEdit: (prescription) =>
        set({
          prescriptionNo: prescription.prescriptionNo,
          patient: prescription.patient,
          diagnosis: prescription.diagnosis || "",
          notes: prescription.notes || "",
          items: prescription.items,
          selectedBranchId: prescription.branchId,
        }),
    }),
    {
      name: "penrx_prescription_storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
