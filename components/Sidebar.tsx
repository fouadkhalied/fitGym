"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";

const navItems = (t: ReturnType<typeof useI18n>["t"]) => [
  { href: "/", label: t.nav.dashboard, icon: "⊞" },
  { href: "/customers", label: t.nav.customers, icon: "👥" },
  { href: "/exercises", label: t.nav.exercises, icon: "💪" },
  { href: "/programs", label: t.nav.programs, icon: "📋" },
  { href: "/assignments", label: t.nav.assignments, icon: "📌" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t, locale, setLocale, isRTL } = useI18n();

  return (
    <aside
      className="hidden lg:flex flex-col fixed top-0 bottom-0 w-60 z-40"
      style={{ background: "#0d1117", [isRTL ? "right" : "left"]: 0 }}
    >
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "#10b981" }}
          >
            GT
          </div>
          <span className="text-white font-semibold tracking-tight">GymTrainer</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems(t).map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "text-white"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              }`}
              style={active ? { background: "#10b981" } : {}}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Lang switcher */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={() => setLocale(locale === "en" ? "ar" : "en")}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
        >
          <span>🌐</span>
          <span>{t.common.switchLanguage}</span>
        </button>
      </div>
    </aside>
  );
}
