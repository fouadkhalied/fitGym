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

interface Customer { id: number; name: string }
interface Exercise { id: number; name: string; sets: number; reps: number }
interface Program { id: number; name: string; items: unknown[] }
interface Assignment {
  id: number;
  customer: { id: number; name: string };
  program: { id: number; name: string; items: unknown[] } | null;
  exercise: { id: number; name: string; sets: number; reps: number } | null;
  sets: number | null;
  reps: number | null;
  notes: string | null;
  assignedAt: string;
}

const emptyForm = { customerId: "", type: "program" as "program" | "exercise", programId: "", exerciseId: "", sets: "", reps: "", notes: "" };

export default function AssignmentsPage() {
  const { t } = useI18n();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterType, setFilterType] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
              AND (${custId}::int IS NULL OR a."customerId" = ${custId}::int)
              AND (${filterType || null}::text IS NULL OR
                   (${filterType} = 'program' AND a."programId" IS NOT NULL) OR
                   (${filterType} = 'exercise' AND a."exerciseId" IS NOT NULL))`,
        sql`SELECT a.id, a.sets, a.reps, a.notes, a."assignedAt",
              JSON_BUILD_OBJECT('id', c.id, 'name', c.name) AS customer,
              CASE WHEN a."programId" IS NOT NULL
                THEN JSON_BUILD_OBJECT('id', p.id, 'name', p.name, 'items', '[]'::json)
                ELSE NULL END AS program,
              CASE WHEN a."exerciseId" IS NOT NULL
                THEN JSON_BUILD_OBJECT('id', e.id, 'name', e.name, 'sets', e.sets, 'reps', e.reps)
                ELSE NULL END AS exercise
            FROM "Assignment" a
            JOIN "Customer" c ON c.id = a."customerId"
            LEFT JOIN "ExerciseProgram" p ON p.id = a."programId"
            LEFT JOIN "Exercise" e ON e.id = a."exerciseId"
            WHERE c.name ILIKE ${like}
              AND (${custId}::int IS NULL OR a."customerId" = ${custId}::int)
              AND (${filterType || null}::text IS NULL OR
                   (${filterType} = 'program' AND a."programId" IS NOT NULL) OR
                   (${filterType} = 'exercise' AND a."exerciseId" IS NOT NULL))
            ORDER BY a."assignedAt" DESC LIMIT 10 OFFSET ${offset}`,
      ]);
      setAssignments(rows as Assignment[]);
      setTotalPages(Math.max(1, Math.ceil((countRows[0] as { count: number }).count / 10)));
    } finally {
      setLoading(false);
    }
  }, [page, search, filterCustomer, filterType]);

  useEffect(() => {
    const timer = setTimeout(fetchAssignments, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchAssignments, search]);

  useEffect(() => { setPage(1); }, [search, filterCustomer, filterType]);

  useEffect(() => {
    sql`SELECT id, name FROM "Customer" ORDER BY name`.then((r: any) => setCustomers(r as Customer[]));
    sql`SELECT id, name, sets, reps FROM "Exercise" ORDER BY name`.then((r: any) => setExercises(r as Exercise[]));
    sql`SELECT id, name FROM "ExerciseProgram" ORDER BY name`.then((r: any) => setPrograms(r as Program[]));
  }, []);

  function openAdd() { setEditing(null); setForm(emptyForm); setErrors({}); setModalOpen(true); }
  function openEdit(a: Assignment) {
    setEditing(a);
    setForm({
      customerId: String(a.customer.id),
      type: a.program ? "program" : "exercise",
      programId: a.program ? String(a.program.id) : "",
      exerciseId: a.exercise ? String(a.exercise.id) : "",
      sets: a.sets ? String(a.sets) : "",
      reps: a.reps ? String(a.reps) : "",
      notes: a.notes || "",
    });
    setErrors({});
    setModalOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.customerId) e.customerId = t.validation.required;
    if (form.type === "program" && !form.programId) e.programId = t.validation.required;
    if (form.type === "exercise" && !form.exerciseId) e.exerciseId = t.validation.required;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const customerId = Number(form.customerId);
      const programId = form.type === "program" && form.programId ? Number(form.programId) : null;
      const exerciseId = form.type === "exercise" && form.exerciseId ? Number(form.exerciseId) : null;
      const sets = form.sets ? Number(form.sets) : null;
      const reps = form.reps ? Number(form.reps) : null;
      const notes = form.notes || null;
      if (editing) {
        await sql`UPDATE "Assignment" SET "customerId"=${customerId}, "programId"=${programId}, "exerciseId"=${exerciseId}, sets=${sets}, reps=${reps}, notes=${notes}, "updatedAt"=NOW() WHERE id=${editing.id}`;
      } else {
        await sql`INSERT INTO "Assignment" ("customerId", "programId", "exerciseId", sets, reps, notes, "assignedAt", "createdAt", "updatedAt") VALUES (${customerId}, ${programId}, ${exerciseId}, ${sets}, ${reps}, ${notes}, NOW(), NOW(), NOW())`;
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
      <div className="grid sm:grid-cols-3 gap-3">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.assignments.search} className={inputCls} />
        <select className={selectCls} value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)}>
          <option value="">{t.assignments.filterByCustomer}</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className={selectCls} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">{t.assignments.filterByType}</option>
          <option value="program">{t.assignments.typeProgram}</option>
          <option value="exercise">{t.assignments.typeExercise}</option>
        </select>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
              <th className="px-5 py-3 text-start font-medium">{t.assignments.customer}</th>
              <th className="px-5 py-3 text-start font-medium">{t.assignments.type}</th>
              <th className="px-5 py-3 text-start font-medium">{t.assignments.program} / {t.assignments.exercise}</th>
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
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.program ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"}`}>
                      {a.program ? t.assignments.typeProgram : t.assignments.typeExercise}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-700">
                    {a.program ? (
                      <span>{a.program.name} <span className="text-gray-400 text-xs">({a.program.items.length} ex)</span></span>
                    ) : (
                      <span>{a.exercise?.name} <span className="text-gray-400 text-xs">{(a.sets ?? a.exercise?.sets)}×{(a.reps ?? a.exercise?.reps)}</span></span>
                    )}
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
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{a.customer.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${a.program ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"}`}>
                      {a.program ? t.assignments.typeProgram : t.assignments.typeExercise}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      {a.program ? a.program.name : `${a.exercise?.name} · ${a.sets ?? a.exercise?.sets}×${a.reps ?? a.exercise?.reps}`}
                    </p>
                    <p className="text-xs text-gray-300 mt-0.5">{new Date(a.assignedAt).toLocaleDateString()}</p>
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t.assignments.edit : t.assignments.add}>
        <div className="space-y-4">
          <FormField label={t.assignments.customer} error={errors.customerId}>
            <select className={selectCls} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">{t.assignments.selectCustomer}</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>

          <FormField label={t.assignments.type}>
            <div className="flex gap-4">
              {(["program", "exercise"] as const).map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={form.type === type} onChange={() => setForm({ ...form, type, programId: "", exerciseId: "", sets: "", reps: "" })} className="accent-emerald-500" />
                  <span className="text-sm text-gray-700">{type === "program" ? t.assignments.typeProgram : t.assignments.typeExercise}</span>
                </label>
              ))}
            </div>
          </FormField>

          {form.type === "program" ? (
            <FormField label={t.assignments.program} error={errors.programId}>
              <select className={selectCls} value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })}>
                <option value="">{t.assignments.selectProgram}</option>
                {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
          ) : (
            <>
              <FormField label={t.assignments.exercise} error={errors.exerciseId}>
                <select className={selectCls} value={form.exerciseId} onChange={(e) => setForm({ ...form, exerciseId: e.target.value })}>
                  <option value="">{t.assignments.selectExercise}</option>
                  {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label={t.assignments.sets} optional>
                  <input type="number" min="1" className={inputCls} value={form.sets} onChange={(e) => setForm({ ...form, sets: e.target.value })} />
                </FormField>
                <FormField label={t.assignments.reps} optional>
                  <input type="number" min="1" className={inputCls} value={form.reps} onChange={(e) => setForm({ ...form, reps: e.target.value })} />
                </FormField>
              </div>
            </>
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
