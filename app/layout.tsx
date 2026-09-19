import type { Metadata } from "next";
import { I18nProvider } from "@/lib/i18n";
import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";

export const metadata: Metadata = {
  title: "GymTrainer — Trainer Dashboard",
  description: "Manage customers, exercises, programs, and assignments",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/tailwind.css" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; }
          body { margin: 0; background: #f8fafc; color: #111827; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
          button, input, select, textarea { font: inherit; }
          ::-webkit-scrollbar { width: 4px; height: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }
          [dir="rtl"] .lg\\:ml-60 { margin-left: 0; margin-right: 15rem; }
        `}</style>
      </head>
      <body>
        <I18nProvider>
          <Sidebar />
          <MobileNav />
          <main className="lg:ml-60 pt-14 lg:pt-0 min-h-screen bg-gray-50">
            <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">{children}</div>
          </main>
        </I18nProvider>
      </body>
    </html>
  );
}
