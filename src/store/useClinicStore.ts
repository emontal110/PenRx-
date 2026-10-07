import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface Branch {
  id: string;
  name: string;
  nameAr: string;
  address: string;
  phone: string;
  workingHours: string;
  isDefault: boolean;
  doctorName?: string;
  doctorTitle?: string;
  specialty?: string;
  syndicateId?: string;
}

export type PrescriptionTemplate =
  | "classic"
  | "modern_wave"
  | "tech_hex"
  | "luxury_gold"
  | "minimal_clean"
  | "clinical_sidebar";

export interface ClinicSettings {
  id: string;
  name: string;
  nameAr: string;
  doctorName: string;
  doctorTitle: string;
  specialty: string;
  syndicateId: string;
  phone: string;
  address?: string;
  logoUrl?: string;
  logoWidth?: number;
  primaryColor: string;
  fontFamily: string;
  templateId?: PrescriptionTemplate;
  headerText?: string;
  footerText?: string;
  workingHours?: string;
  paperSize: "A5" | "A6" | "A4" | "B5";
  showHeader: boolean;
  showFooter: boolean;
  biometricsEnabled: boolean;
  isProfileSaved?: boolean;
  visibleFields?: {
    showAge: boolean;
    showGender: boolean;
    showHeight: boolean;
    showWeight: boolean;
    showBloodType: boolean;
    showDiagnosis: boolean;
    showMedicalHistory: boolean;
    showAllergies: boolean;
  };
}

interface ClinicStoreState {
  clinic: ClinicSettings;
  branches: Branch[];
  activeBranchId: string;

  updateClinic: (updates: Partial<ClinicSettings>) => void;
  saveClinicAndCreateFirstBranch: (updates: Partial<ClinicSettings>) => void;
  addBranch: (branch: Omit<Branch, "id">) => string;
  updateBranch: (id: string, updates: Partial<Branch>) => void;
  deleteBranch: (id: string) => void;
  setActiveBranchId: (id: string) => void;
  setDefaultBranch: (id: string) => void;
}

const DEFAULT_CLINIC: ClinicSettings = {
  id: "clinic-default-01",
  name: "",
  nameAr: "",
  doctorName: "",
  doctorTitle: "",
  specialty: "",
  syndicateId: "",
  phone: "",
  address: "",
  logoUrl: "/logo-penrx.jpg",
  logoWidth: 80,
  primaryColor: "#059669",
  fontFamily: "'Cairo', sans-serif",
  templateId: "classic",
  headerText: "",
  footerText: "",
  workingHours: "يومياً من 4 مساءً حتى 10 مساءً",
  paperSize: "A5",
  showHeader: true,
  showFooter: true,
  biometricsEnabled: false,
  isProfileSaved: false,
  visibleFields: {
    showAge: false,
    showGender: false,
    showHeight: false,
    showWeight: false,
    showBloodType: false,
    showDiagnosis: true,
    showMedicalHistory: false,
    showAllergies: false,
  },
};

// No mock or demo branches initially - created automatically on first clinic profile save
const DEFAULT_BRANCHES: Branch[] = [];

export const useClinicStore = create<ClinicStoreState>()(
  persist(
    (set, get) => ({
      clinic: DEFAULT_CLINIC,
      branches: DEFAULT_BRANCHES,
      activeBranchId: "",

      updateClinic: (updates) =>
        set((state) => ({ clinic: { ...state.clinic, ...updates, isProfileSaved: true } })),

      saveClinicAndCreateFirstBranch: (updates) => {
        set((state) => {
          const updatedClinic = { ...state.clinic, ...updates, isProfileSaved: true };
          let updatedBranches = [...state.branches];
          let newActiveId = state.activeBranchId;

          // If no branches exist, automatically create the primary branch from clinic data
          if (updatedBranches.length === 0) {
            const branchNameAr = (updatedClinic.nameAr || updatedClinic.name || `العيادة`).trim();
            const branchNameEn = (updatedClinic.name || "Main Branch").trim();
            const firstBranchId = `branch-${Date.now()}`;
            const firstBranch: Branch = {
              id: firstBranchId,
              name: branchNameEn,
              nameAr: branchNameAr,
              address: (updatedClinic.address || updatedClinic.headerText || "").trim(),
              phone: updatedClinic.phone || "",
              workingHours: (updatedClinic.workingHours || "يومياً من 4 مساءً حتى 10 مساءً").trim(),
              isDefault: true,
              doctorName: updatedClinic.doctorName || "",
              doctorTitle: updatedClinic.doctorTitle || "",
              specialty: updatedClinic.specialty || "",
              syndicateId: updatedClinic.syndicateId || "",
            };
            updatedBranches = [firstBranch];
            newActiveId = firstBranchId;
          } else {
            // Completely sync clinic & doctor data to the active/current branch
            const targetId = state.activeBranchId || updatedBranches[0]?.id;
            updatedBranches = updatedBranches.map((b) =>
              b.id === targetId
                ? {
                    ...b,
                    nameAr: updatedClinic.nameAr ? updatedClinic.nameAr.trim() : b.nameAr,
                    name: updatedClinic.name ? updatedClinic.name.trim() : b.name,
                    address: updatedClinic.address !== undefined ? updatedClinic.address.trim() : b.address,
                    phone: updatedClinic.phone !== undefined ? updatedClinic.phone.trim() : b.phone,
                    workingHours: updatedClinic.workingHours !== undefined ? updatedClinic.workingHours.trim() : b.workingHours,
                    doctorName: updatedClinic.doctorName ? updatedClinic.doctorName.trim() : b.doctorName,
                    doctorTitle: updatedClinic.doctorTitle ? updatedClinic.doctorTitle.trim() : b.doctorTitle,
                    specialty: updatedClinic.specialty ? updatedClinic.specialty.trim() : b.specialty,
                    syndicateId: updatedClinic.syndicateId ? updatedClinic.syndicateId.trim() : b.syndicateId,
                  }
                : b
            );
          }

          return {
            clinic: updatedClinic,
            branches: updatedBranches,
            activeBranchId: newActiveId || (updatedBranches[0]?.id ?? ""),
          };
        });
      },

      addBranch: (newBranch) => {
        const id = `branch-${Date.now()}`;
        set((state) => {
          const isFirst = state.branches.length === 0;
          const branchWithId: Branch = {
            ...newBranch,
            id,
            isDefault: isFirst ? true : !!newBranch.isDefault,
          };
          return {
            branches: [...state.branches, branchWithId],
            activeBranchId: id,
          };
        });
        return id;
      },

      updateBranch: (id, updates) =>
        set((state) => {
          const updatedBranches = state.branches.map((b) => (b.id === id ? { ...b, ...updates } : b));
          const targetId = state.activeBranchId || state.branches[0]?.id;
          let updatedClinic = { ...state.clinic };
          if (id === targetId) {
            if (updates.nameAr) updatedClinic.nameAr = updates.nameAr;
            if (updates.name) updatedClinic.name = updates.name;
            if (updates.address) updatedClinic.address = updates.address;
            if (updates.phone) updatedClinic.phone = updates.phone;
            if (updates.workingHours) updatedClinic.workingHours = updates.workingHours;
            if (updates.doctorName) updatedClinic.doctorName = updates.doctorName;
            if (updates.doctorTitle) updatedClinic.doctorTitle = updates.doctorTitle;
            if (updates.specialty) updatedClinic.specialty = updates.specialty;
            if (updates.syndicateId) updatedClinic.syndicateId = updates.syndicateId;
          }
          return {
            branches: updatedBranches,
            clinic: updatedClinic,
          };
        }),

      deleteBranch: (id) =>
        set((state) => {
          const filtered = state.branches.filter((b) => b.id !== id);
          const nextActiveId =
            state.activeBranchId === id
              ? filtered[0]?.id || ""
              : state.activeBranchId;
          return {
            branches: filtered,
            activeBranchId: nextActiveId,
          };
        }),

      setActiveBranchId: (id) => set({ activeBranchId: id }),

      setDefaultBranch: (id) =>
        set((state) => ({
          branches: state.branches.map((b) => ({
            ...b,
            isDefault: b.id === id,
          })),
        })),
    }),
    {
      name: "penrx_clinic_storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
