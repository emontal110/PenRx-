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
}

export interface ClinicSettings {
  id: string;
  name: string;
  nameAr: string;
  doctorName: string;
  doctorTitle: string;
  specialty: string;
  syndicateId: string;
  phone: string;
  logoUrl?: string;
  primaryColor: string;
  headerText?: string;
  footerText?: string;
  paperSize: "A4" | "A5";
  showHeader: boolean;
  showFooter: boolean;
  biometricsEnabled: boolean;
}

interface ClinicStoreState {
  clinic: ClinicSettings;
  branches: Branch[];
  activeBranchId: string;

  updateClinic: (updates: Partial<ClinicSettings>) => void;
  addBranch: (branch: Omit<Branch, "id">) => void;
  updateBranch: (id: string, updates: Partial<Branch>) => void;
  deleteBranch: (id: string) => void;
  setActiveBranchId: (id: string) => void;
}

const DEFAULT_CLINIC: ClinicSettings = {
  id: "clinic-default-01",
  name: "PenRX+ Medical Clinic",
  nameAr: "عيادة د. أيمن الاستشارية",
  doctorName: "د. أيمن",
  doctorTitle: "استشاري الباطنة والجراحة العامة",
  specialty: "طب عام وباطنة",
  syndicateId: "EGY-789210",
  phone: "+20 109 408 5228",
  logoUrl: "/logo-penrx.jpg",
  primaryColor: "#059669",
  headerText: "مركز PenRX+ للرعاية الطبية والتشخيص الدقيق",
  footerText: "نتمنى لكم الشفاء العاجل والدوام بالصحة والعافية • للحجز والاستفسار: 01094085228",
  paperSize: "A4",
  showHeader: true,
  showFooter: true,
  biometricsEnabled: false,
};

const DEFAULT_BRANCHES: Branch[] = [
  {
    id: "branch-01",
    name: "Main Branch",
    nameAr: "الفرع الرئيسي - المهندسين",
    address: "شارع جامعة الدول العربية، المهندسين، الجيزة",
    phone: "01094085228",
    workingHours: "يومياً من 4 مساءً حتى 10 مساءً",
    isDefault: true,
  },
  {
    id: "branch-02",
    name: "Nasr City Branch",
    nameAr: "فرع مدينة نصر",
    address: "شارع عباس العقاد، مدينة نصر، القاهرة",
    phone: "01094085228",
    workingHours: "السبت والاثنين والأربعاء (12 ظهراً - 6 مساءً)",
    isDefault: false,
  },
];

export const useClinicStore = create<ClinicStoreState>()(
  persist(
    (set, get) => ({
      clinic: DEFAULT_CLINIC,
      branches: DEFAULT_BRANCHES,
      activeBranchId: "branch-01",

      updateClinic: (updates) =>
        set((state) => ({ clinic: { ...state.clinic, ...updates } })),

      addBranch: (newBranch) => {
        const id = `branch-${Date.now()}`;
        set((state) => ({
          branches: [...state.branches, { ...newBranch, id }],
        }));
      },

      updateBranch: (id, updates) =>
        set((state) => ({
          branches: state.branches.map((b) => (b.id === id ? { ...b, ...updates } : b)),
        })),

      deleteBranch: (id) =>
        set((state) => ({
          branches: state.branches.filter((b) => b.id !== id),
          activeBranchId:
            state.activeBranchId === id
              ? state.branches.find((b) => b.id !== id)?.id || ""
              : state.activeBranchId,
        })),

      setActiveBranchId: (id) => set({ activeBranchId: id }),
    }),
    {
      name: "penrx_clinic_storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
