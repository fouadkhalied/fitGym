"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { sql } from "@/lib/db";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Stats {
  totalCustomers: number;
  totalExercises: number;
  totalPrograms: number;
  totalAssignments: number;
}

interface RecentCustomer {
  id: number;
  name: string;
  phone: string;
}

interface RecentAssignment {
  id: number;
  customerName: string;
  programName: string | null;
  exerciseName: string | null;
  sets: number | null;
  reps: number | null;
}

export default function DashboardPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([]);
  const [recentAssignments, setRecentAssignments] = useState<RecentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [statsRows, customerRows, assignmentRows] = await Promise.all([
          sql`SELECT
            (SELECT COUNT(*)::int FROM "Customer") AS "totalCustomers",
            (SELECT COUNT(*)::int FROM "Exercise") AS "totalExercises",
            (SELECT COUNT(*)::int FROM "ExerciseProgram") AS "totalPrograms",
            (SELECT COUNT(*)::int FROM "Assignment") AS "totalAssignments"`,
          sql`SELECT id, name, phone FROM "Customer" ORDER BY "createdAt" DESC LIMIT 5`,
          sql`SELECT a.id, a.sets, a.reps,
              c.name AS "customerName",
              p.name AS "programName",
              e.name AS "exerciseName"
            FROM "Assignment" a
            JOIN "Customer" c ON c.id = a."customerId"
            LEFT JOIN "ExerciseProgram" p ON p.id = a."programId"
            LEFT JOIN "Exercise" e ON e.id = a."exerciseId"
            ORDER BY a."assignedAt" DESC LIMIT 5`,
        ]);
        setStats(statsRows[0] as Stats);
        setRecentCustomers(customerRows as RecentCustomer[]);
        setRecentAssignments(assignmentRows as RecentAssignment[]);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const statCards = stats
    ? [
        { label: t.dashboard.totalCustomers, value: stats.totalCustomers, color: "#10b981", icon: "👥" },
        { label: t.dashboard.totalExercises, value: stats.totalExercises, color: "#6366f1", icon: "💪" },
        { label: t.dashboard.totalPrograms, value: stats.totalPrograms, color: "#f59e0b", icon: "📋" },
        { label: t.dashboard.totalAssignments, value: stats.totalAssignments, color: "#ef4444", icon: "📌" },
      ]
    : [];

  const quickActions = [
    { label: t.dashboard.addCustomer, href: "/customers", color: "#10b981" },
    { label: t.dashboard.addExercise, href: "/exercises", color: "#6366f1" },
    { label: t.dashboard.createProgram, href: "/programs", color: "#f59e0b" },
    { label: t.dashboard.assignExercise, href: "/assignments", color: "#ef4444" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.dashboard.title}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          ⚠️ Could not connect to the database. Check your Neon credentials.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 animate-pulse">
                <div className="h-8 w-12 bg-gray-200 rounded mb-2" />
                <div className="h-4 w-24 bg-gray-100 rounded" />
              </div>
            ))
          : statCards.map((card) => (
              <div key={card.label} className="bg-white rounded-xl p-5 border border-gray-100">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl">{card.icon}</span>
                  <div className="w-2 h-2 rounded-full" style={{ background: card.color }} />
                </div>
                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                <p className="text-sm text-gray-500 mt-1">{card.label}</p>
              </div>
            ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">{t.dashboard.recentCustomers}</h2>
            <Link href="/customers" className="text-xs text-emerald-600 hover:underline">View all</Link>
          </div>
          {recentCustomers.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">{t.dashboard.noRecentCustomers}</p>
          ) : (
            <ul className="divide-y divide-gray-50 -mx-5 px-5">
              {recentCustomers.map((c) => (
                <li key={c.id} className="py-3">
                  <Link href={`/customers/${c.id}`} className="block hover:text-emerald-600 transition-colors">
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.phone}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">{t.dashboard.recentAssignments}</h2>
            <Link href="/assignments" className="text-xs text-emerald-600 hover:underline">View all</Link>
          </div>
          {recentAssignments.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">{t.dashboard.noRecentAssignments}</p>
          ) : (
            <ul className="divide-y divide-gray-50 -mx-5 px-5">
              {recentAssignments.map((a) => (
                <li key={a.id} className="py-3">
                  <p className="text-sm font-medium text-gray-900">{a.customerName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {a.programName ?? `${a.exerciseName} ${a.sets ?? ""}×${a.reps ?? ""}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">{t.dashboard.quickActions}</h2>
          <div className="space-y-2">
            {quickActions.map((a) => (
              <button
                key={a.label}
                onClick={() => router.push(a.href)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: a.color }} />
                <span className="text-sm font-medium text-gray-700">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
