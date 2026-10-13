"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { showGlobalToast } from "./GlobalToast";

export function CapacitorNativeBridge() {
  const pathname = usePathname();
  const router = useRouter();
  const listenersAttached = useRef(false);

  useEffect(() => {
    let unlistenBackButton: (() => void) | undefined;
    let offlineHandler: (() => void) | undefined;
    let onlineHandler: (() => void) | undefined;

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

        // 2. Network connectivity listeners (attach only once to prevent accumulation)
        if (!listenersAttached.current) {
          listenersAttached.current = true;
          offlineHandler = () => {
            showGlobalToast("⚠️ تم فقدان الاتصال بالإنترنت. يرجى التحقق من الشبكة.", "error");
          };
          onlineHandler = () => {
            showGlobalToast("✅ عاد الاتصال بالإنترنت بنجاح.", "success");
          };
          window.addEventListener("offline", offlineHandler);
          window.addEventListener("online", onlineHandler);
        }
      } catch (e) {
        // Silent catch for non-capacitor environments
      }
    }

    setupNativeBridge();

    return () => {
      if (unlistenBackButton) {
        unlistenBackButton();
      }
      if (offlineHandler) {
        window.removeEventListener("offline", offlineHandler);
      }
      if (onlineHandler) {
        window.removeEventListener("online", onlineHandler);
        listenersAttached.current = false;
      }
    };
  }, [pathname, router]);

  return null;
}
