"use client";

/**
 * NewRxGuard
 * ──────────
 * Intercepts navigation to /prescriptions/new when there is unsaved prescription data.
 *
 * FIX: Uses onClickCapture (capture phase = fires BEFORE child elements) with
 * e.stopPropagation() so the event never reaches Next.js Link's handler.
 * This is the only reliable approach for intercepting Next.js client-side routing.
 */

import React, { useCallback, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { usePrescriptionStore } from "@/store/usePrescriptionStore";
import { useClinicStore } from "@/store/useClinicStore";
import { NewPrescriptionPromptModal } from "@/components/prescription/NewPrescriptionPromptModal";
import { showGlobalToast } from "@/components/common/GlobalToast";

interface NewRxGuardProps {
  children: React.ReactNode;
  onDone?: () => void;
}

export function NewRxGuard({ children, onDone }: NewRxGuardProps) {
  const router = useRouter();
  const pathname = usePathname();

  const {
    patient,
    items,
    diagnosis,
    notes,
    selectedBranchId,
    savePrescription,
    resetCurrentPrescription,
  } = usePrescriptionStore();

  const { branches } = useClinicStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const hasPrescriptionData = Boolean(
    (patient.name && patient.name.trim().length > 0) ||
    items.length > 0 ||
    (diagnosis && diagnosis.trim().length > 0) ||
    (notes && notes.trim().length > 0) ||
    (patient.phone && patient.phone.trim().length > 0)
  );

  const navigateToNew = useCallback(() => {
    router.push("/prescriptions/new");
    onDone?.();
  }, [router, onDone]);

  /**
   * onClickCapture fires during the CAPTURE phase (top-down, before any child).
   * Calling e.stopPropagation() here prevents the event from ever reaching the
   * Next.js <Link> element — completely blocking its navigation.
   */
  const handleCapture = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      // Skip if already on the new-prescription page
      if (pathname === "/prescriptions/new") return;

      if (hasPrescriptionData) {
        e.stopPropagation(); // prevent Link from ever receiving this click
        e.preventDefault();  // belt & suspenders
        setIsModalOpen(true);
      }
    },
    [pathname, hasPrescriptionData]
  );

  const handleSaveAndContinue = useCallback(() => {
    const branchObj = branches.find((b) => b.id === selectedBranchId);
    savePrescription(branchObj?.nameAr);
    resetCurrentPrescription();
    setIsModalOpen(false);
    showGlobalToast("✅ تم حفظ الروشتة بالسجل! جاري فتح روشتة جديدة...");
    navigateToNew();
  }, [branches, selectedBranchId, savePrescription, resetCurrentPrescription, navigateToNew]);

  const handleConfirmDiscard = useCallback(() => {
    resetCurrentPrescription();
    setIsModalOpen(false);
    navigateToNew();
  }, [resetCurrentPrescription, navigateToNew]);

  return (
    <>
      {/*
        The span uses onClickCapture which fires BEFORE any descendant handler.
        display:contents removes any layout impact — the span is invisible to flex/grid.
      */}
      <span
        style={{ display: "contents" }}
        onClickCapture={handleCapture}
      >
        {children}
      </span>

      <NewPrescriptionPromptModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        patientName={patient.name}
        itemsCount={items.length}
        diagnosis={diagnosis}
        onSaveAndContinue={handleSaveAndContinue}
        onConfirmDiscard={handleConfirmDiscard}
      />
    </>
  );
}
