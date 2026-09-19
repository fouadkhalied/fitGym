"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useState } from "react";

export function MobileNav() {
  const pathname = usePathname();
  const { t, locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);

  const navItems = [
    { href: "/", label: t.nav.dashboard, icon: "⊞" },
    { href: "/customers", label: t.nav.customers, icon: "👥" },
    { href: "/exercises", label: t.nav.exercises, icon: "💪" },
    { href: "/programs", label: t.nav.programs, icon: "📋" },
    { href: "/assignments", label: t.nav.assignments, icon: "📌" },
  ];

  return (
    <>
      {/* Top bar */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 border-b border-gray-200 bg-white"
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold"
            style={{ background: "#10b981" }}
          >
            GT
          </div>
          <span className="font-semibold text-gray-900 text-sm">GymTrainer</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLocale(locale === "en" ? "ar" : "en")}
            className="text-xs text-gray-500 px-2 py-1 rounded border border-gray-200"
          >
            {t.common.switchLanguage}
          </button>
          <button
            onClick={() => setOpen(!open)}
            className="p-1.5 rounded-lg text-gray-600"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {/* Drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <nav
            className="absolute top-0 bottom-0 w-64 bg-[#0d1117] flex flex-col"
            style={{ left: locale === "ar" ? "auto" : 0, right: locale === "ar" ? 0 : "auto" }}
          >
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">GT</div>
                <span className="text-white font-semibold text-sm">GymTrainer</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/50 text-lg">✕</button>
            </div>
            <div className="flex-1 px-3 py-4 space-y-0.5">
              {navItems.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active ? "text-white bg-emerald-500" : "text-white/50 hover:text-white/80 hover:bg-white/5"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
