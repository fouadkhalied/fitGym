"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { sql } from "@/lib/db";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toast } from "@/components/ui/Toast";
import { FormField, inputCls, selectCls } from "@/components/ui/FormField";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface Customer { id: number; name: string }
interface ProgramExercise { id: number; name: string; sets: number; reps: number; order: number }
interface Program { id: number; name: string; exercises: ProgramExercise[] }
interface Assignment {
  id: number;
  customer: { id: number; name: string };
  program: { id: number; name: string };
  notes: string | null;
  exerciseDays: Record<string, string[]>; // exerciseId (string) → days[]
  assignedAt: string;
  exercises: ProgramExercise[]; // exercises in the assigned program
}

// exerciseDays form state: exerciseId (number) → { included: boolean, days: string[] }
interface ExerciseDayEntry { included: boolean; days: string[] }

const emptyForm = {
  customerId: "",
  programId: "",
  notes: "",
  exerciseDays: {} as Record<number, ExerciseDayEntry>,
};

export default function AssignmentsPage() {
  const { t } = useI18n();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Currently selected program object (to show its exercises in modal)
  const selectedProgram = programs.find(p => String(p.id) === form.programId) ?? null;

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const like = `%${search}%`;
      const offset = (page - 1) * 10;
      const custId = filterCustomer ? Number(filterCustomer) : null;
      const [countRows, rows] = await Promise.all([
        sql`SELECT COUNT(*)::int AS count FROM "Assignment" a
            JOIN "Customer" c ON c.id = a."customerId"
            WHERE c.name ILIKE ${like}
              AND (${custId}::int IS NULL OR a."customerId" = ${custId}::int)`,
        sql`SELECT a.id, a.notes, a."assignedAt", a."exerciseDays",
              JSON_BUILD_OBJECT('id', c.id, 'name', c.name) AS customer,
              JSON_BUILD_OBJECT('id', p.id, 'name', p.name) AS program,
              COALESCE(
                JSON_AGG(
                  JSON_BUILD_OBJECT('id', e.id, 'name', e.name, 'sets', epi.sets, 'reps', epi.reps, 'order', epi."order")
                  ORDER BY epi."order"
                ) FILTER (WHERE epi.id IS NOT NULL), '[]'
              ) AS exercises
            FROM "Assignment" a
            JOIN "Customer" c ON c.id = a."customerId"
            JOIN "ExerciseProgram" p ON p.id = a."programId"
            LEFT JOIN "ExerciseProgramItem" epi ON epi."programId" = a."programId"
            LEFT JOIN "Exercise" e ON e.id = epi."exerciseId"
            WHERE c.name ILIKE ${like}
              AND (${custId}::int IS NULL OR a."customerId" = ${custId}::int)
            GROUP BY a.id, c.id, p.id
            ORDER BY a."assignedAt" DESC LIMIT 10 OFFSET ${offset}`,
      ]);
      setAssignments(rows as Assignment[]);
      setTotalPages(Math.max(1, Math.ceil((countRows[0] as { count: number }).count / 10)));
    } finally {
      setLoading(false);
    }
  }, [page, search, filterCustomer]);

  useEffect(() => {
    const timer = setTimeout(fetchAssignments, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchAssignments, search]);

  useEffect(() => { setPage(1); }, [search, filterCustomer]);

  useEffect(() => {
    sql`SELECT id, name FROM "Customer" ORDER BY name`.then((r: any) => setCustomers(r as Customer[]));
    sql`SELECT p.id, p.name,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT('id', e.id, 'name', e.name, 'sets', epi.sets, 'reps', epi.reps, 'order', epi."order")
              ORDER BY epi."order"
            ) FILTER (WHERE epi.id IS NOT NULL), '[]'
          ) AS exercises
        FROM "ExerciseProgram" p
        LEFT JOIN "ExerciseProgramItem" epi ON epi."programId" = p.id
        LEFT JOIN "Exercise" e ON e.id = epi."exerciseId"
        GROUP BY p.id
        ORDER BY p.name`
      .then((r: any) => setPrograms(r as Program[]));
  }, []);

  // When program changes in form, reset exerciseDays to include all exercises by default
  function onProgramChange(programId: string) {
    const prog = programs.find(p => String(p.id) === programId);
    const exerciseDays: Record<number, ExerciseDayEntry> = {};
    if (prog) {
      for (const ex of prog.exercises) {
        exerciseDays[ex.id] = { included: true, days: [] };
      }
    }
    setForm(f => ({ ...f, programId, exerciseDays }));
  }

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setModalOpen(true);
  }

  function openEdit(a: Assignment) {
    setEditing(a);
    // Rebuild exerciseDays form state from saved data
    const prog = programs.find(p => p.id === a.program.id);
    const exerciseDays: Record<number, ExerciseDayEntry> = {};
    if (prog) {
      for (const ex of prog.exercises) {
        const savedDays: string[] = a.exerciseDays?.[String(ex.id)] ?? [];
        exerciseDays[ex.id] = {
          included: savedDays.length > 0 || String(ex.id) in (a.exerciseDays ?? {}),
          days: savedDays,
        };
      }
    }
    setForm({ customerId: String(a.customer.id), programId: String(a.program.id), notes: a.notes || "", exerciseDays });
    setErrors({});
    setModalOpen(true);
  }

  function toggleExercise(exId: number, included: boolean) {
    setForm(f => ({ ...f, exerciseDays: { ...f.exerciseDays, [exId]: { ...f.exerciseDays[exId], included } } }));
  }

  function toggleDay(exId: number, day: string) {
    const entry = form.exerciseDays[exId] ?? { included: true, days: [] };
    const days = entry.days.includes(day) ? entry.days.filter(d => d !== day) : [...entry.days, day];
    setForm(f => ({ ...f, exerciseDays: { ...f.exerciseDays, [exId]: { ...entry, included: true, days } } }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.customerId) e.customerId = t.validation.required;
    if (!form.programId) e.programId = t.validation.required;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const customerId = Number(form.customerId);
      const programId = Number(form.programId);
      const notes = form.notes || null;
      // Build exerciseDays JSON: only included exercises
      const exerciseDays: Record<string, string[]> = {};
      for (const [id, entry] of Object.entries(form.exerciseDays)) {
        if (entry.included) exerciseDays[id] = entry.days;
      }
      const exerciseDaysJson = JSON.stringify(exerciseDays);
      if (editing) {
        await sql`UPDATE "Assignment" SET "customerId"=${customerId}, "programId"=${programId}, notes=${notes}, "exerciseDays"=${exerciseDaysJson}::jsonb, "updatedAt"=NOW() WHERE id=${editing.id}`;
      } else {
        await sql`INSERT INTO "Assignment" ("customerId", "programId", notes, "exerciseDays", "assignedAt", "createdAt", "updatedAt") VALUES (${customerId}, ${programId}, ${notes}, ${exerciseDaysJson}::jsonb, NOW(), NOW(), NOW())`;
      }
      setModalOpen(false);
      setToast({ message: editing ? "Assignment updated" : "Assignment created", type: "success" });
      fetchAssignments();
    } catch {
      setToast({ message: t.common.error, type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await sql`DELETE FROM "Assignment" WHERE id=${deleteTarget.id}`;
      setDeleteTarget(null);
      setToast({ message: "Assignment deleted", type: "success" });
      fetchAssignments();
    } catch {
      setToast({ message: t.common.error, type: "error" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t.assignments.title}</h1>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ background: "#10b981" }}>
          <span>+</span> {t.assignments.add}
        </button>
      </div>

      {/* Filters */}
      <div className="grid sm:grid-cols-2 gap-3">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.assignments.search} className={inputCls} />
        <select className={selectCls} value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)}>
          <option value="">{t.assignments.filterByCustomer}</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
              <th className="px-5 py-3 text-start font-medium">{t.assignments.customer}</th>
              <th className="px-5 py-3 text-start font-medium">Program</th>
              <th className="px-5 py-3 text-start font-medium">Schedule</th>
              <th className="px-5 py-3 text-start font-medium">{t.assignments.assignedAt}</th>
              <th className="px-5 py-3 text-start font-medium">{t.assignments.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
              ))
            ) : assignments.length === 0 ? (
              <tr><td colSpan={5}><EmptyState message={t.assignments.empty} action={{ label: t.assignments.add, onClick: openAdd }} /></td></tr>
            ) : (
              assignments.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4 font-medium text-gray-900">{a.customer.name}</td>
                  <td className="px-5 py-4">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-600">{a.program.name}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="space-y-1">
                      {a.exercises.filter(ex => a.exerciseDays?.[String(ex.id)] !== undefined).slice(0, 3).map(ex => {
                        const days: string[] = a.exerciseDays?.[String(ex.id)] ?? [];
                        return (
                          <div key={ex.id} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 font-medium min-w-[80px] truncate">{ex.name}</span>
                            <div className="flex gap-1 flex-wrap">
                              {days.length > 0
                                ? days.map(d => <span key={d} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[10px] font-semibold">{d.slice(0, 3)}</span>)
                                : <span className="text-gray-300 text-[10px]">any day</span>}
                            </div>
                          </div>
                        );
                      })}
                      {Object.keys(a.exerciseDays ?? {}).length > 3 && <span className="text-gray-300 text-xs">+{Object.keys(a.exerciseDays).length - 3} more</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-400 text-xs">{new Date(a.assignedAt).toLocaleDateString()}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(a)} className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">{t.common.edit}</button>
                      <button onClick={() => setDeleteTarget(a)} className="text-xs px-2.5 py-1 rounded-md border border-red-200 text-red-500 hover:bg-red-50">{t.common.delete}</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-white rounded-xl border p-4 animate-pulse h-24" />) :
          assignments.length === 0 ? <EmptyState message={t.assignments.empty} action={{ label: t.assignments.add, onClick: openAdd }} /> :
            assignments.map((a) => (
              <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 text-sm">{a.customer.name}</p>
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-600">{a.program.name}</span>
                    <div className="mt-2 space-y-1">
                      {a.exercises.filter(ex => a.exerciseDays?.[String(ex.id)] !== undefined).slice(0, 2).map(ex => {
                        const days: string[] = a.exerciseDays?.[String(ex.id)] ?? [];
                        return (
                          <div key={ex.id} className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] text-gray-500 font-medium">{ex.name}:</span>
                            {days.length > 0
                              ? days.map(d => <span key={d} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[10px] font-semibold">{d.slice(0, 3)}</span>)
                              : <span className="text-gray-300 text-[10px]">any day</span>}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-300 mt-1">{new Date(a.assignedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(a)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600">{t.common.edit}</button>
                    <button onClick={() => setDeleteTarget(a)} className="text-xs px-2 py-1 rounded border border-red-200 text-red-500">{t.common.delete}</button>
                  </div>
                </div>
              </div>
            ))
        }
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t.assignments.edit : t.assignments.add} maxWidth="max-w-2xl">
        <div className="space-y-5">
          <FormField label={t.assignments.customer} error={errors.customerId}>
            <select className={selectCls} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">{t.assignments.selectCustomer}</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>

          <FormField label="Program" error={errors.programId}>
            <select className={selectCls} value={form.programId} onChange={(e) => onProgramChange(e.target.value)}>
              <option value="">Select a program...</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>

          {/* Per-exercise day assignment */}
          {selectedProgram && selectedProgram.exercises.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Exercise Schedule</p>
              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                {selectedProgram.exercises.map(ex => {
                  const entry = form.exerciseDays[ex.id] ?? { included: false, days: [] };
                  return (
                    <div key={ex.id} className={`rounded-lg border p-3 transition-colors ${entry.included ? "border-indigo-200 bg-indigo-50/30" : "border-gray-100 bg-gray-50"}`}>
                      {/* Exercise header: toggle include */}
                      <div className="flex items-center gap-3 mb-2">
                        <button
                          type="button"
                          onClick={() => toggleExercise(ex.id, !entry.included)}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${entry.included ? "bg-indigo-500 border-indigo-500" : "border-gray-300 bg-white"}`}
                        >
                          {entry.included && <span className="text-white text-[10px] font-bold">✓</span>}
                        </button>
                        <span className="text-sm font-medium text-gray-800">{ex.name}</span>
                        <span className="text-xs text-gray-400">{ex.sets}×{ex.reps}</span>
                      </div>
                      {/* Days pill buttons — only visible when included */}
                      {entry.included && (
                        <div className="flex flex-wrap gap-1.5 pl-8">
                          {DAYS.map(day => {
                            const selected = entry.days.includes(day);
                            return (
                              <button
                                key={day} type="button"
                                onClick={() => toggleDay(ex.id, day)}
                                className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors border ${selected ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}
                              >
                                {day.slice(0, 3)}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <FormField label={t.assignments.notes} optional>
            <textarea rows={2} className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </FormField>

          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">{t.common.cancel}</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50" style={{ background: "#10b981" }}>
              {saving ? t.common.loading : t.common.save}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title={t.assignments.delete} message={t.assignments.deleteConfirm} loading={deleting} />
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
