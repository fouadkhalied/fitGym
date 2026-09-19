"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { sql } from "@/lib/db";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toast } from "@/components/ui/Toast";
import { FormField, inputCls } from "@/components/ui/FormField";

interface Exercise {
  id: number;
  name: string;
  description: string | null;
  sets: number;
  reps: number;
}

const emptyForm = { name: "", description: "", sets: "3", reps: "10" };

export default function ExercisesPage() {
  const { t } = useI18n();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchExercises = useCallback(async () => {
    setLoading(true);
    try {
      const like = `%${search}%`;
      const offset = (page - 1) * 10;
      const [countRows, rows] = await Promise.all([
        sql`SELECT COUNT(*)::int AS count FROM "Exercise" WHERE name ILIKE ${like}`,
        sql`SELECT id, name, description, sets, reps FROM "Exercise" WHERE name ILIKE ${like} ORDER BY "createdAt" DESC LIMIT 10 OFFSET ${offset}`,
      ]);
      setExercises(rows as Exercise[]);
      setTotalPages(Math.max(1, Math.ceil((countRows[0] as { count: number }).count / 10)));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = setTimeout(fetchExercises, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchExercises, search]);

  useEffect(() => { setPage(1); }, [search]);

  function openAdd() { setEditing(null); setForm(emptyForm); setErrors({}); setModalOpen(true); }
  function openEdit(e: Exercise) {
    setEditing(e);
    setForm({ name: e.name, description: e.description || "", sets: String(e.sets), reps: String(e.reps) });
    setErrors({});
    setModalOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t.validation.required;
    if (!form.sets || Number(form.sets) < 1) e.sets = t.validation.positiveNumber;
    if (!form.reps || Number(form.reps) < 1) e.reps = t.validation.positiveNumber;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const sets = Number(form.sets);
      const reps = Number(form.reps);
      const description = form.description || null;
      if (editing) {
        await sql`UPDATE "Exercise" SET name=${form.name}, description=${description}, sets=${sets}, reps=${reps}, "updatedAt"=NOW() WHERE id=${editing.id}`;
      } else {
        await sql`INSERT INTO "Exercise" (name, description, sets, reps, "createdAt", "updatedAt") VALUES (${form.name}, ${description}, ${sets}, ${reps}, NOW(), NOW())`;
      }
      setModalOpen(false);
      setToast({ message: editing ? "Exercise updated" : "Exercise added", type: "success" });
      fetchExercises();
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
      await sql`DELETE FROM "Exercise" WHERE id=${deleteTarget.id}`;
      setDeleteTarget(null);
      setToast({ message: "Exercise deleted", type: "success" });
      fetchExercises();
    } catch {
      setToast({ message: t.common.error, type: "error" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t.exercises.title}</h1>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ background: "#10b981" }}>
          <span>+</span> {t.exercises.add}
        </button>
      </div>

      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.exercises.search} className={inputCls} />

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
              <th className="px-5 py-3 text-start font-medium">{t.exercises.name}</th>
              <th className="px-5 py-3 text-start font-medium">{t.exercises.description}</th>
              <th className="px-5 py-3 text-start font-medium">{t.exercises.sets} × {t.exercises.reps}</th>
              <th className="px-5 py-3 text-start font-medium">{t.exercises.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 4 }).map((_, j) => <td key={j} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
              ))
            ) : exercises.length === 0 ? (
              <tr><td colSpan={4}><EmptyState message={t.exercises.empty} action={{ label: t.exercises.add, onClick: openAdd }} /></td></tr>
            ) : (
              exercises.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4 font-medium text-gray-900">{e.name}</td>
                  <td className="px-5 py-4 text-gray-500 max-w-xs truncate">{e.description || "—"}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                      {e.sets} × {e.reps}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(e)} className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">{t.common.edit}</button>
                      <button onClick={() => setDeleteTarget(e)} className="text-xs px-2.5 py-1 rounded-md border border-red-200 text-red-500 hover:bg-red-50">{t.common.delete}</button>
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
        {loading ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse h-20" />) :
          exercises.length === 0 ? <EmptyState message={t.exercises.empty} action={{ label: t.exercises.add, onClick: openAdd }} /> :
          exercises.map((e) => (
            <div key={e.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{e.name}</p>
                  <span className="text-xs font-medium text-emerald-600">{e.sets} × {e.reps}</span>
                  {e.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{e.description}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(e)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600">{t.common.edit}</button>
                  <button onClick={() => setDeleteTarget(e)} className="text-xs px-2 py-1 rounded border border-red-200 text-red-500">{t.common.delete}</button>
                </div>
              </div>
            </div>
          ))
        }
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t.exercises.edit : t.exercises.add}>
        <div className="space-y-4">
          <FormField label={t.exercises.name} error={errors.name}>
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label={t.exercises.description} optional>
            <textarea rows={3} className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t.exercises.sets} error={errors.sets}>
              <input type="number" min="1" className={inputCls} value={form.sets} onChange={(e) => setForm({ ...form, sets: e.target.value })} />
            </FormField>
            <FormField label={t.exercises.reps} error={errors.reps}>
              <input type="number" min="1" className={inputCls} value={form.reps} onChange={(e) => setForm({ ...form, reps: e.target.value })} />
            </FormField>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">{t.common.cancel}</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50" style={{ background: "#10b981" }}>
              {saving ? t.common.loading : t.common.save}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title={t.exercises.delete} message={t.exercises.deleteConfirm} loading={deleting} />
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
