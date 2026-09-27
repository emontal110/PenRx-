import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { PaywallGuard } from "@/components/common/PaywallGuard";
import { AutoUpdateModal } from "@/components/common/AutoUpdateModal";

export const metadata: Metadata = {
  title: "PenRX+ | منظومة إدارة الروشتات والعيادات الطبية الذكية",
  description: "البرنامج الأحدث والأسرع في مصر لكتابة الروشتات الطبية، إدارة المرضى، وبنك الأدوية الشامل بالذكاء الاصطناعي.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
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
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <PaywallGuard>{children}</PaywallGuard>
        </main>
        <AutoUpdateModal />
      </body>
    </html>
  );
}
