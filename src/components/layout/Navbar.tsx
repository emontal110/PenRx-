"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  FileText,
  Clock,
  Building2,
  Settings,
  Crown,
  LayoutDashboard,
  ShieldCheck,
  Laptop,
  Menu,
  X,
  Sparkles,
  Fingerprint,
} from "lucide-react";
import { useSubscriptionStore, getSubscriptionDetails } from "@/store/useSubscriptionStore";
import { useClinicStore } from "@/store/useClinicStore";
import versionConfig from "@/config/version.json";

export function Navbar() {
  const pathname = usePathname();
  const { subscriptions, machineId, syncWithServer } = useSubscriptionStore();
  const { clinic } = useClinicStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    syncWithServer();
  }, [syncWithServer]);

  const subDetails = getSubscriptionDetails(subscriptions, machineId);

  const NAV_LINKS = [
    { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
    { href: "/prescriptions/new", label: "كتابة الروشتات", icon: FileText, highlight: true },
    { href: "/history", label: "سجل الروشتات والمرضى", icon: Clock },
    { href: "/branches", label: "الفروع والعيادات", icon: Building2 },
    { href: "/settings", label: "الإعدادات العامة", icon: Settings },
    { href: "/subscriptions", label: "الاشتراكات", icon: Crown },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-2xl overflow-hidden border-2 border-emerald-500/40 shadow-lg shadow-emerald-950/50 group-hover:border-emerald-400 transition-all">
              <Image
                src="/logo-penrx.jpg"
                alt="PenRX+"
                fill
                sizes="48px"
                priority
                className="object-cover"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xl sm:text-2xl font-black bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent font-sans tracking-tight">
                  PenRX+
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                  PRO
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-slate-800/90 text-emerald-300 text-[10px] font-mono font-bold border border-slate-700/80 shadow-sm" title={`الإصدار الحالي: v${versionConfig.version}`}>
                  v{versionConfig.version}
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-400 -mt-1 truncate max-w-[150px] sm:max-w-[200px]">
                {clinic.nameAr || clinic.name}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1.5">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-md"
                      : link.highlight
                      ? "bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-950/40 hover:scale-105"
                      : "text-slate-300 hover:text-white hover:bg-slate-900 border border-transparent"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Status / Device Badge */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Subscription Status Chip */}
            <Link
              href="/subscriptions"
              suppressHydrationWarning
              className={`px-3 py-1.5 rounded-xl border text-[11px] font-black flex items-center gap-1.5 transition-all shadow-sm ${subDetails.badgeColor}`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span suppressHydrationWarning>{subDetails.statusLabel}</span>
              {subDetails.isActive && (
                <span className="font-mono text-emerald-300">({subDetails.daysRemaining}ي)</span>
              )}
            </Link>

            {/* Hardware Machine ID Tag */}
            <div className="hidden xl:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-mono" title="Machine ID">
              <Laptop className="w-3 h-3 text-emerald-400" />
              <span suppressHydrationWarning>{mounted ? machineId.substring(0, 12) + "..." : "PRX-..."}</span>
            </div>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex lg:hidden items-center gap-2">
            <Link
              href="/subscriptions"
              suppressHydrationWarning
              className={`px-2.5 py-1 rounded-xl border text-[10px] font-black flex items-center gap-1 ${subDetails.badgeColor}`}
            >
              <Crown className="w-3 h-3" />
              <span suppressHydrationWarning>{subDetails.isActive ? `${subDetails.daysRemaining}ي` : "تفعيل"}</span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-900 text-slate-300 border border-slate-800 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-950/95 border-b border-slate-800 p-4 space-y-2 backdrop-blur-2xl animate-in slide-in-from-top-4 duration-150">
          {NAV_LINKS.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black transition-all ${
                  isActive
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : link.highlight
                    ? "bg-emerald-600 text-white font-extrabold"
                    : "text-slate-300 hover:bg-slate-900"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
