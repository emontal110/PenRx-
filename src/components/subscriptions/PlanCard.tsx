"use client";

import React from "react";
import { Check, Crown, Sparkles, Zap } from "lucide-react";
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
  features: string[];
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
      className={`relative p-5 sm:p-6 transition-all duration-200 flex flex-col justify-between overflow-hidden group ${
        plan.popular
          ? "border-emerald-500/80 bg-gradient-to-b from-slate-900/90 to-emerald-950/20 shadow-emerald-950/40 ring-1 ring-emerald-500/30"
          : isSelected
          ? "border-teal-500/80 bg-slate-900/90 shadow-teal-950/30 ring-1 ring-teal-500/30"
          : "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900/90"
      }`}
    >
      {/* Popular or Discount Floating Ribbon */}
      {plan.badge && (
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10">
          <Badge
            variant={plan.popular ? "success" : isFree ? "brand" : "warning"}
            className="text-[11px] font-black shadow-sm"
          >
            {plan.badge}
          </Badge>
        </div>
      )}

      <div>
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              isFree
                ? "bg-teal-500/10 text-teal-400 border-teal-500/20"
                : plan.popular
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-sm"
                : "bg-slate-800 text-slate-300 border-slate-700"
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
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-100">
              {plan.nameAr}
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {plan.durationLabel}
            </span>
          </div>
        </div>

        {/* Pricing Display */}
        <div className="my-4 py-3 border-y border-slate-800/80 flex items-baseline justify-between">
          <div className="flex items-baseline gap-1" dir="ltr">
            <span className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
              {isFree ? "0" : plan.price}
            </span>
            <span className="text-xs font-bold text-slate-400">
              {isFree ? "مجاناً بالكامل" : "ج.م مصري"}
            </span>
          </div>

          {plan.originalPrice && (
            <div className="text-right">
              <span className="text-xs line-through text-slate-500 block font-mono">
                {plan.originalPrice} ج.م
              </span>
              {plan.discountText && (
                <span className="text-[11px] font-bold text-emerald-400">
                  {plan.discountText}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Features List */}
        <ul className="space-y-2.5 text-xs text-slate-300 my-4">
          {plan.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2 leading-relaxed">
              <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Select Plan Button */}
      <div className="mt-5 pt-3 border-t border-slate-800/60">
        <Button
          variant={plan.popular ? "primary" : isFree ? "soft" : "secondary"}
          onClick={() => onSelect(plan)}
          disabled={disabled}
          className="w-full text-xs sm:text-sm font-black"
        >
          {isFree ? "ابدأ التجربة المجانية الآن 🎁" : "اختيار هذه الباقة والدفع ⚡"}
        </Button>
      </div>
    </Card>
  );
}
