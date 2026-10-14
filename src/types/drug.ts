export interface DrugRecord {
  id: string;
  name: string;
  nameAr?: string;
  activeIngredient: string;
  activeIngredientAr?: string;
  company?: string;
  price?: number;
  dosageForm?: string;
  category?: string;
  isControlled?: boolean;
  sourceOrigin?: "Egyptian Bank" | "International / Imported" | "Cosmetics & Aesthetics" | "Dental Care" | "Vitamins & Supplements" | "Doctor Community";
  isCrowdSourced?: boolean;
  doctorContributor?: string;
  isEssential?: boolean;
}
