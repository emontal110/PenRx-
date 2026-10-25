"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { showGlobalToast } from "./GlobalToast";
import { useSubscriptionStore, getSubscriptionDetails } from "@/store/useSubscriptionStore";

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

        // 1. Android Hardware Back Button Handling with 2500ms safety timeout
        const nativeInitPromise = (async () => {
          const { App } = await import("@capacitor/app");
          const backHandle = await App.addListener("backButton", ({ canGoBack }) => {
            if (pathname === "/") {
              // Exit app if on root home page
              App.exitApp();
            } else if (pathname === "/subscriptions") {
              // If subscription is locked/inactive, back button exits app; if active, returns home
              const subState = useSubscriptionStore.getState();
              const subDetails = getSubscriptionDetails(subState.subscriptions, subState.machineId, subState.subscriberId);
              if (!subDetails.isActive) {
                App.exitApp();
              } else if (canGoBack || window.history.length > 1) {
                window.history.back();
              } else {
                router.push("/");
              }
            } else if (canGoBack || window.history.length > 1) {
              window.history.back();
            } else {
              router.push("/");
            }
          });

          unlistenBackButton = () => {
            try {
              backHandle.remove();
            } catch {}
          };
        })();

        const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 2500));
        await Promise.race([nativeInitPromise, timeoutPromise]);

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
