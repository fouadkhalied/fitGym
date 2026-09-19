"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { sql } from "@/lib/db";
import Link from "next/link";
import { useParams } from "next/navigation";

interface ProgramExercise {
  id: number;
  name: string;
  sets: number;
  reps: number;
}

interface Assignment {
  id: number;
  programId: number;
  programName: string;
  notes: string | null;
  assignedAt: string | Date;
  // Prisma `Json` column: the days chosen for each exercise, e.g. { "12": ["Mon", "Wed"] }
  exerciseDays: Record<string, unknown> | null;
  exercises: ProgramExercise[];
}

// Works with either a list of days (["Mon", "Wed"]) or a plain number (3)
function getDayInfo(value: unknown): { labels: string[]; count: number } {
  if (Array.isArray(value)) return { labels: value.map(String), count: value.length };
  if (typeof value === "number") return { labels: [], count: value };
  return { labels: [], count: 0 };
}

// Days per exercise, plus the number of distinct days the whole program covers
function summarizeDays(a: Assignment) {
  const allLabels = new Set<string>();
  let maxCount = 0;
  const exercises = a.exercises.map((ex) => {
    const raw = a.exerciseDays?.[String(ex.id)] ?? a.exerciseDays?.[ex.name];
    const info = getDayInfo(raw);
    info.labels.forEach((label) => allLabels.add(label));
    maxCount = Math.max(maxCount, info.count);
    return { ...ex, ...info };
  });
  return { exercises, numOfDays: allLabels.size || maxCount };
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  age: number | null;
  gender: string | null;
  notes: string | null;
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const customerId = Number(id);

    // A non-numeric id would make Postgres throw, so treat it as "not found"
    if (!Number.isInteger(customerId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const [customerRows, assignmentRows] = await Promise.all([
          sql`SELECT id, name, phone, email, age, gender, notes
              FROM "Customer" WHERE id = ${customerId}`,
          // Assignment only has a program (programId is required); the sets and
          // reps live on ExerciseProgramItem, so we aggregate them per program.
          // AT TIME ZONE 'UTC' turns Prisma's timestamp (stored in UTC) into a
          // timestamptz so the browser converts it to local time correctly.
          sql`SELECT a.id, a.notes, a."exerciseDays",
                a."assignedAt" AT TIME ZONE 'UTC' AS "assignedAt",
                p.id AS "programId",
                p.name AS "programName",
                COALESCE(
                  JSON_AGG(
                    JSON_BUILD_OBJECT('id', e.id, 'name', e.name, 'sets', epi.sets, 'reps', epi.reps)
                    ORDER BY epi."order"
                  ) FILTER (WHERE epi.id IS NOT NULL), '[]'
                ) AS exercises
              FROM "Assignment" a
              JOIN "ExerciseProgram" p ON p.id = a."programId"
              LEFT JOIN "ExerciseProgramItem" epi ON epi."programId" = p.id
              LEFT JOIN "Exercise" e ON e.id = epi."exerciseId"
              WHERE a."customerId" = ${customerId}
              GROUP BY a.id, p.id
              ORDER BY a."assignedAt" DESC`,
        ]);

        if (cancelled) return;

        if (customerRows.length === 0) {
          setNotFound(true);
          return;
        }

        setCustomer(customerRows[0] as Customer);
        setAssignments(assignmentRows as Assignment[]);
      } catch (e) {
        console.error("Failed to load customer:", e);
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <div className="text-gray-400 text-sm p-8">{t.common.loading}</div>;
  if (notFound) return <div className="text-gray-400 text-sm p-8">Customer not found.</div>;
  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 break-words">
        ⚠️ {t.common.error}: {error}
      </div>
    );
  }
  if (!customer) return null;

  const field = (label: string, value: string | number | null | undefined) =>
    value !== null && value !== undefined && value !== "" ? (
      <div key={label}>
        <dt className="text-xs text-gray-400 uppercase tracking-wide">{label}</dt>
        <dd className="text-sm text-gray-900 font-medium mt-0.5">{value}</dd>
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/customers" className="text-gray-400 hover:text-gray-600 text-sm">← Back</Link>
        <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Info */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">{t.customers.customerDetails}</h2>
          <dl className="space-y-3">
            {field(t.customers.name, customer.name)}
            {field(t.customers.phone, customer.phone)}
            {field(t.customers.email, customer.email)}
            {field(t.customers.age, customer.age)}
            {field(t.customers.gender, customer.gender)}
            {field(t.customers.notes, customer.notes)}
          </dl>
        </div>

        {/* Assigned programs */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">{t.customers.assignedPrograms}</h2>
          {assignments.length === 0 ? (
            <p className="text-sm text-gray-400">{t.customers.noPrograms}</p>
          ) : (
            <ul className="space-y-3">
              {assignments.map((a) => {
                const { exercises, numOfDays } = summarizeDays(a);
                return (
                  <li key={a.id} className="p-4 rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📋</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{a.programName}</p>
                          <p className="text-xs text-gray-400">{new Date(a.assignedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {numOfDays > 0 && (
                        <span className="text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1 whitespace-nowrap">
                          {numOfDays} {numOfDays === 1 ? "day" : "days"}
                        </span>
                      )}
                    </div>

                    {exercises.length > 0 && (
                      <ul className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
                        {exercises.map((ex) => (
                          <li key={ex.id} className="flex items-start justify-between gap-3 text-xs text-gray-600">
                            <div>
                              <span>{ex.name}</span>
                              {ex.labels.length > 0 && (
                                <p className="text-gray-400 mt-0.5">{ex.labels.join(", ")}</p>
                              )}
                            </div>
                            <span className="text-gray-400 whitespace-nowrap">
                              {ex.sets} × {ex.reps}
                              {ex.count > 0 && ` · ${ex.count} ${ex.count === 1 ? "day" : "days"}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {a.notes && <p className="mt-3 text-xs text-gray-500">{a.notes}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}