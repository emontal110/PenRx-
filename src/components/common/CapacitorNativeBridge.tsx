"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { showGlobalToast } from "./GlobalToast";

export function CapacitorNativeBridge() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let unlistenBackButton: (() => void) | undefined;

    async function setupNativeBridge() {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        // 1. Android Hardware Back Button Handling
        const { App } = await import("@capacitor/app");
        const backHandle = await App.addListener("backButton", ({ canGoBack }) => {
          if (pathname === "/" || pathname === "/subscriptions") {
            // Exit app if on root page
            App.exitApp();
          } else if (canGoBack || window.history.length > 1) {
            window.history.back();
          } else {
            router.push("/");
          }
        });

        unlistenBackButton = () => {
          backHandle.remove();
        };

        // 2. Network connectivity listener
        window.addEventListener("offline", () => {
          showGlobalToast("⚠️ تم فقدان الاتصال بالإنترنت. يرجى التحقق من الشبكة.", "error");
        });

        window.addEventListener("online", () => {
          showGlobalToast("✅ عاد الاتصال بالإنترنت بنجاح.", "success");
        });
      } catch (e) {
        // Silent catch for non-capacitor environments
      }
    }

    setupNativeBridge();

    return () => {
      if (unlistenBackButton) {
        unlistenBackButton();
      }
    };
  }, [pathname, router]);

  return null;
}
