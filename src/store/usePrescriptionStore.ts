import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  enqueueSyncAction,
  pullCloudPrescriptions,
  runSmartCacheCleanup,
  RETENTION_MS,
} from "@/lib/prescriptionSync";
import { useSubscriptionStore } from "./useSubscriptionStore";
import {
  UnifiedPatientRecord,
  extractUnifiedPatients,
  normalizePatientName,
  normalizePhoneDigits,
} from "@/lib/patientRegistry";

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
  height?: number | string;
  weight?: number | string;
  bloodType?: string;
  allergyNotes?: string;
  medicalHistory?: string;
}

export interface VisiblePatientFields {
  showAge: boolean;
  showGender: boolean;
  showHeight: boolean;
  showWeight: boolean;
  showBloodType: boolean;
  showDiagnosis: boolean;
  showMedicalHistory: boolean;
  showAllergies: boolean;
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
  isArchived?: boolean;
  archivedAt?: string;
}

interface PrescriptionStoreState {
  prescriptionNo: string;
  patient: PatientInfo;
  diagnosis: string;
  notes: string;
  items: PrescriptionItem[];
  selectedBranchId: string;
  visibleFields: VisiblePatientFields;
  savedPrescriptions: SavedPrescription[];
  savedPatients: PatientInfo[];

  setPatient: (patient: Partial<PatientInfo>) => void;
  setDiagnosis: (diag: string) => void;
  setNotes: (notes: string) => void;
  setSelectedBranchId: (id: string) => void;
  toggleVisibleField: (field: keyof VisiblePatientFields) => void;
  setVisibleFields: (fields: Partial<VisiblePatientFields>) => void;

  addItem: (item: Omit<PrescriptionItem, "id">) => void;
  updateItem: (id: string, updates: Partial<PrescriptionItem>) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
  resetCurrentPrescription: () => void;

  savePrescription: (branchName?: string) => SavedPrescription;
  deleteSavedPrescription: (id: string) => void;
  loadPrescriptionToEdit: (prescription: SavedPrescription) => void;
  syncWithCloud: () => Promise<void>;
  cleanExpiredCache: () => void;
  setSavedPrescriptions: (records: SavedPrescription[]) => void;
  setSavedPatients: (patients: PatientInfo[]) => void;
  toggleArchivePrescription: (id: string) => void;
  archivePrescriptionsForYear: (year: number) => number;
  getUnifiedPatients: () => UnifiedPatientRecord[];
}

function generatePrescriptionNo(): string {
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PRX-${dateStr}-${rand}`;
}

const DEFAULT_VISIBLE_FIELDS: VisiblePatientFields = {
  showAge: false,
  showGender: false,
  showHeight: false,
  showWeight: false,
  showBloodType: false,
  showDiagnosis: true,
  showMedicalHistory: false,
  showAllergies: false,
};

export const usePrescriptionStore = create<PrescriptionStoreState>()(
  persist(
    (set, get) => ({
      prescriptionNo: generatePrescriptionNo(),
      patient: {
        name: "",
        age: "",
        gender: "MALE",
        phone: "",
        height: "",
        weight: "",
        bloodType: "",
        allergyNotes: "",
        medicalHistory: "",
      },
      diagnosis: "",
      notes: "",
      items: [],
      selectedBranchId: "",
      visibleFields: DEFAULT_VISIBLE_FIELDS,
      savedPrescriptions: [],
      savedPatients: [],

      setPatient: (updated) =>
        set((state) => ({ patient: { ...state.patient, ...updated } })),

      setDiagnosis: (diagnosis) => set({ diagnosis }),
      setNotes: (notes) => set({ notes }),
      setSelectedBranchId: (selectedBranchId) => set({ selectedBranchId }),

      toggleVisibleField: (field) =>
        set((state) => ({
          visibleFields: {
            ...state.visibleFields,
            [field]: !state.visibleFields[field],
          },
        })),

      setVisibleFields: (fields) =>
        set((state) => ({
          visibleFields: {
            ...state.visibleFields,
            ...fields,
          },
        })),

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
        set((state) => ({ items: state.items.filter((it) => it.id !== id) })),

      clearItems: () => set({ items: [] }),

      resetCurrentPrescription: () =>
        set({
          prescriptionNo: generatePrescriptionNo(),
          patient: {
            name: "",
            age: "",
            gender: "MALE",
            phone: "",
            height: "",
            weight: "",
            bloodType: "",
            allergyNotes: "",
            medicalHistory: "",
          },
          diagnosis: "",
          notes: "",
          items: [],
        }),

      savePrescription: (branchName) => {
        const state = get();
        const now = Date.now();

        // 1. Identify existing patient using stable ID, clean phone, or normalized Arabic name
        const cleanCurrentPhone = normalizePhoneDigits(state.patient.phone || "");
        const normCurrentName = normalizePatientName(state.patient.name || "");

        const existingIdx = state.savedPatients.findIndex((p) => {
          if (state.patient.id && p.id && p.id === state.patient.id) return true;
          const pPhone = normalizePhoneDigits(p.phone || "");
          if (cleanCurrentPhone && cleanCurrentPhone.length >= 7 && pPhone && cleanCurrentPhone === pPhone) return true;
          const pNameNorm = normalizePatientName(p.name || "");
          return Boolean(normCurrentName && pNameNorm && normCurrentName === pNameNorm);
        });

        let updatedPatients = [...state.savedPatients];
        const assignedId =
          state.patient.id ||
          (existingIdx >= 0 && updatedPatients[existingIdx].id) ||
          `pat-${now}-${Math.random().toString(36).slice(2, 7)}`;

        const finalizedPatient: PatientInfo = {
          ...state.patient,
          id: assignedId,
        };

        if (existingIdx >= 0) {
          // Merge patient fields preserving previously saved clinical history
          updatedPatients[existingIdx] = {
            ...updatedPatients[existingIdx],
            ...finalizedPatient,
            phone: finalizedPatient.phone || updatedPatients[existingIdx].phone || "",
            age: finalizedPatient.age || updatedPatients[existingIdx].age || "",
            gender: finalizedPatient.gender || updatedPatients[existingIdx].gender || "MALE",
            height: finalizedPatient.height || updatedPatients[existingIdx].height || "",
            weight: finalizedPatient.weight || updatedPatients[existingIdx].weight || "",
            bloodType: finalizedPatient.bloodType || updatedPatients[existingIdx].bloodType || "",
            allergyNotes: finalizedPatient.allergyNotes || updatedPatients[existingIdx].allergyNotes || "",
            medicalHistory: finalizedPatient.medicalHistory || updatedPatients[existingIdx].medicalHistory || "",
          };
        } else if (finalizedPatient.name.trim()) {
          updatedPatients.unshift(finalizedPatient);
        }

        const newRecord: SavedPrescription = {
          id: `rx-${now}-${Math.random().toString(36).slice(2, 6)}`,
          prescriptionNo: state.prescriptionNo,
          createdAt: new Date().toISOString(),
          patient: finalizedPatient,
          branchId: state.selectedBranchId,
          branchName,
          diagnosis: state.diagnosis,
          notes: state.notes,
          items: state.items,
        };

        // Apply 365-day retention policy (archived records are permanently kept)
        const retainedOld = state.savedPrescriptions.filter((r) => {
          if (r.isArchived) return true;
          const itemTime = new Date(r.createdAt).getTime();
          return !isNaN(itemTime) && now - itemTime <= RETENTION_MS;
        });

        set({
          savedPrescriptions: [newRecord, ...retainedOld],
          savedPatients: updatedPatients,
        });

        // Enqueue background cloud synchronization (offline-first & multi-tenant)
        try {
          const subState = useSubscriptionStore.getState();
          const subId = subState.subscriberId || subState.machineId || "PRX-ACTIVE-SUB";
          enqueueSyncAction("SAVE", newRecord.id, subId, newRecord);
        } catch (err) {
          console.warn("[PrescriptionStore] Cloud sync enqueue error:", err);
        }

        return newRecord;
      },

      deleteSavedPrescription: (id) => {
        set((state) => ({
          savedPrescriptions: state.savedPrescriptions.filter((r) => r.id !== id),
        }));

        // Enqueue background cloud deletion (propagates to all devices of subscriber)
        try {
          const subState = useSubscriptionStore.getState();
          const subId = subState.subscriberId || subState.machineId || "PRX-ACTIVE-SUB";
          enqueueSyncAction("DELETE", id, subId);
        } catch (err) {
          console.warn("[PrescriptionStore] Cloud delete enqueue error:", err);
        }
      },

      setSavedPrescriptions: (records) => set({ savedPrescriptions: records }),
      setSavedPatients: (patients) => set({ savedPatients: patients }),

      toggleArchivePrescription: (id: string) => {
        set((state) => ({
          savedPrescriptions: state.savedPrescriptions.map((rx) => {
            if (rx.id === id) {
              const willArchive = !rx.isArchived;
              const updated: SavedPrescription = {
                ...rx,
                isArchived: willArchive,
                archivedAt: willArchive ? new Date().toISOString() : undefined,
              };
              try {
                const subState = useSubscriptionStore.getState();
                const subId = subState.subscriberId || subState.machineId || "PRX-ACTIVE-SUB";
                enqueueSyncAction("SAVE", updated.id, subId, updated);
              } catch {}
              return updated;
            }
            return rx;
          }),
        }));
      },

      archivePrescriptionsForYear: (year: number) => {
        let count = 0;
        const nowIso = new Date().toISOString();
        set((state) => ({
          savedPrescriptions: state.savedPrescriptions.map((rx) => {
            const rxYear = new Date(rx.createdAt).getFullYear();
            if (rxYear === year && !rx.isArchived) {
              count++;
              const updated: SavedPrescription = {
                ...rx,
                isArchived: true,
                archivedAt: nowIso,
              };
              try {
                const subState = useSubscriptionStore.getState();
                const subId = subState.subscriberId || subState.machineId || "PRX-ACTIVE-SUB";
                enqueueSyncAction("SAVE", updated.id, subId, updated);
              } catch {}
              return updated;
            }
            return rx;
          }),
        }));
        return count;
      },

      loadPrescriptionToEdit: (prescription) =>
        set({
          prescriptionNo: prescription.prescriptionNo,
          patient: prescription.patient,
          diagnosis: prescription.diagnosis || "",
          notes: prescription.notes || "",
          items: prescription.items,
          selectedBranchId: prescription.branchId,
        }),

      syncWithCloud: async () => {
        try {
          const subState = useSubscriptionStore.getState();
          const subId = subState.subscriberId || subState.machineId;
          if (!subId) return;

          const cloudRecords = await pullCloudPrescriptions(subId);
          if (!cloudRecords || cloudRecords.length === 0) return;

          const state = get();
          const localMap = new Map<string, SavedPrescription>();

          // Merge local and cloud records (cloud updates newest first, avoiding duplicates)
          cloudRecords.forEach((r) => localMap.set(r.id, r));
          state.savedPrescriptions.forEach((r) => {
            if (!localMap.has(r.id)) {
              localMap.set(r.id, r);
            }
          });

          const now = Date.now();
          const merged = Array.from(localMap.values())
            .filter((r) => {
              if (r.isArchived) return true;
              const itemTime = new Date(r.createdAt).getTime();
              return !isNaN(itemTime) && now - itemTime <= RETENTION_MS;
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          // Synchronize savedPatients from cloud merged prescriptions
          const unifiedPats = extractUnifiedPatients(state.savedPatients, merged);
          set({ savedPrescriptions: merged, savedPatients: unifiedPats });
        } catch (err) {
          console.warn("[PrescriptionStore] syncWithCloud error:", err);
        }
      },

      cleanExpiredCache: () => {
        runSmartCacheCleanup(
          () => get().savedPrescriptions,
          (records) => set({ savedPrescriptions: records })
        );
      },

      getUnifiedPatients: () => {
        const state = get();
        return extractUnifiedPatients(state.savedPatients, state.savedPrescriptions);
      },
    }),
    {
      name: "penrx_prescription_storage",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          return {
            ...persistedState,
            visibleFields: {
              ...DEFAULT_VISIBLE_FIELDS,
              ...(persistedState?.visibleFields || {}),
              showAge: false,
              showGender: false,
              showAllergies: false,
              showDiagnosis: true,
            },
          };
        }
        return persistedState;
      },
    }
  )
);
