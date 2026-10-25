import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { SubscriptionExpiryBanner } from "@/components/common/SubscriptionExpiryBanner";
import { PaywallGuard } from "@/components/common/PaywallGuard";
import { AutoUpdateModal } from "@/components/common/AutoUpdateModal";
import { GlobalToastContainer } from "@/components/common/GlobalToast";
import { AppHydrationSplash } from "@/components/common/AppHydrationSplash";
import { CapacitorNativeBridge } from "@/components/common/CapacitorNativeBridge";
import { MobileBiometricLock } from "@/components/common/MobileBiometricLock";

export const metadata: Metadata = {
  title: "PenRX+ | منظومة إدارة الروشتات والعيادات الطبية الذكية",
  description: "البرنامج الأحدث والأسرع في مصر لكتابة الروشتات الطبية، إدارة المرضى، وبنك الأدوية الشامل بالذكاء الاصطناعي.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "PenRX+",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#1C252A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="preload" as="image" href="/icon-192.png" />
      </head>
      <body suppressHydrationWarning className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
        <AppHydrationSplash>
          {/* Unified Sticky Header: binds TitleBar + Navbar together so they stick smoothly with zero content clipping on scroll */}
          <div className="sticky top-0 z-40 w-full bg-slate-950 no-print print:!hidden">
            <DesktopTitleBar />
            <Navbar />
          </div>
          <CapacitorNativeBridge />
          <MobileBiometricLock />
          <main className="max-w-7xl 2xl:max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20 md:pb-8 print:!m-0 print:!p-0 print:!max-w-none print:!w-full">
            <SubscriptionExpiryBanner />
            <PaywallGuard>{children}</PaywallGuard>
          </main>
          <AutoUpdateModal />
          <GlobalToastContainer />
        </AppHydrationSplash>
      </body>
    </html>
  );
}
