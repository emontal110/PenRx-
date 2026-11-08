"use client";

import React from "react";
import { Crown, Sparkles, Zap } from "lucide-react";
import { Button, Card, Badge } from "@/components/ui";

export interface PlanItem {
  id: string;
  nameAr: string;
  durationDays: number;
  durationLabel: string;
  price: number;
  originalPrice?: number;
  discountText?: string;
  badge?: string;
  badgeColor?: string;
  popular?: boolean;
  isTrial?: boolean;
  summary?: string;
}

interface PlanCardProps {
  plan: PlanItem;
  isSelected?: boolean;
  onSelect: (plan: PlanItem) => void;
  disabled?: boolean;
}

export function PlanCard({ plan, isSelected, onSelect, disabled }: PlanCardProps) {
  const isFree = plan.price === 0;

  return (
    <Card
      className={`p-4 sm:p-5 transition-all duration-200 rounded-2xl ${
        plan.popular
          ? "border-emerald-500/70 bg-gradient-to-b from-slate-900/95 to-emerald-950/20 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500/25"
          : isSelected
          ? "border-teal-500/70 bg-slate-900/95 ring-1 ring-teal-500/25"
          : "border-slate-800/90 bg-slate-900/75 hover:border-slate-700 hover:bg-slate-900/90"
      }`}
    >
      <div className="flex flex-col gap-3.5">
        {/* Top Row: Plan Identity & Non-Overlapping Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                isFree
                  ? "bg-teal-500/10 text-teal-400 border-teal-500/25"
                  : plan.popular
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/35"
                  : "bg-slate-800/90 text-amber-400 border-slate-700/80"
              }`}
            >
              {plan.popular ? (
                <Crown className="w-5 h-5 text-emerald-400" />
              ) : isFree ? (
                <Sparkles className="w-5 h-5 text-teal-400" />
              ) : (
                <Zap className="w-5 h-5 text-amber-400" />
              )}
            </div>

            <div className="min-w-0">
              <h3 className="text-base font-black text-slate-100 leading-snug">
                {plan.nameAr}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {plan.durationLabel}
              </p>
            </div>
          </div>

          {plan.badge && (
            <Badge
              variant={plan.popular ? "success" : isFree ? "brand" : "warning"}
              className="text-[10px] px-2.5 py-0.5 font-bold shrink-0 whitespace-nowrap"
            >
              {plan.badge}
            </Badge>
          )}
        </div>

        {/* Middle Row: Price & Action Button */}
        <div className="pt-3 border-t border-slate-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-baseline justify-between sm:justify-start gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
                {isFree ? "0" : plan.price.toLocaleString("en-US")}
              </span>
              <span className="text-xs font-bold text-slate-400">
                {isFree ? "مجاناً بالكامل" : "ج.م"}
              </span>
            </div>

            {(plan.originalPrice || plan.discountText) && (
              <div className="flex items-center gap-2">
                {plan.originalPrice && (
                  <span className="text-xs line-through text-slate-500 font-mono">
                    {plan.originalPrice} ج.م
                  </span>
                )}
                {plan.discountText && (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    {plan.discountText}
                  </span>
                )}
              </div>
            )}
          </div>

          <Button
            variant={plan.popular ? "primary" : isFree ? "soft" : "secondary"}
            onClick={() => onSelect(plan)}
            disabled={disabled}
            className="w-full sm:w-auto sm:min-w-[175px] text-xs font-black py-2.5"
          >
            {isFree ? "تفعيل التجربة المجانية 🎁" : "اختيار الباقة والدفع ⚡"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
