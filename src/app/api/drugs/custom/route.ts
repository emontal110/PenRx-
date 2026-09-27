import { NextResponse } from "next/server";
import { registerCustomDrug } from "@/lib/drugSearchEngine";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, nameAr, activeIngredient, activeIngredientAr, dosageForm, price, company, category, doctorContributor } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Drug name is required" }, { status: 400 });
    }

    const cleanName = name.trim();
    const cleanActiveIng = (activeIngredient || "تركيبة طبية خاصة").trim();

    // 1. Register immediately in memory for instant local search
    const memoryRecord = registerCustomDrug({
      name: cleanName,
      nameAr: nameAr?.trim() || cleanName,
      activeIngredient: cleanActiveIng,
      activeIngredientAr: activeIngredientAr?.trim(),
      dosageForm: dosageForm?.trim() || "Tablet (قرص)",
      price: price ? Number(price) : 0,
      company: company?.trim() || "مساهمة من طبيب في مجتمع PenRX+",
      category: category?.trim() || "General Medicine",
      doctorContributor: doctorContributor?.trim() || "طبيب ممارس",
    });

    // 2. Persist to database so other doctors automatically get it
    let dbRecord = null;
    try {
      dbRecord = await prisma.drug.create({
        data: {
          id: memoryRecord.id,
          name: cleanName,
          nameAr: nameAr?.trim() || cleanName,
          activeIngredient: cleanActiveIng,
          activeIngredientAr: activeIngredientAr?.trim() || null,
          dosageForm: dosageForm?.trim() || "Tablet",
          price: price ? Number(price) : null,
          company: company?.trim() || "مساهمة من طبيب",
          category: category?.trim() || "عام",
          isControlled: false,
        },
      });
    } catch (dbErr: any) {
      // If table already has identical ID or offline, ignore duplicate
      console.warn("DB insert notice:", dbErr.message);
    }

    return NextResponse.json({
      success: true,
      message: "تم حفظ الدواء في بنك الأدوية العام ومشاركته مع جميع الأطباء بنجاح",
      drug: memoryRecord,
      dbSaved: !!dbRecord,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to add drug" }, { status: 500 });
  }
}
