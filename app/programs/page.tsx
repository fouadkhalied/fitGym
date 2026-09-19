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

interface Exercise {
  id: number;
  name: string;
  sets: number;
  reps: number;
}

interface ProgramItem {
  exerciseId: number;
  exerciseName: string;
  order: number;
  sets: number;
  reps: number;
}

interface Program {
  id: number;
  name: string;
  description: string | null;
  items: { exercise: Exercise; order: number; sets: number; reps: number }[];
}

export default function ProgramsPage() {
  const { t } = useI18n();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formItems, setFormItems] = useState<ProgramItem[]>([]);
  const [selectedExId, setSelectedExId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Program | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [nameError, setNameError] = useState("");

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const like = `%${search}%`;
      const offset = (page - 1) * 10;
      const [countRows, rows] = await Promise.all([
        sql`SELECT COUNT(*)::int AS count FROM "ExerciseProgram" WHERE name ILIKE ${like}`,
        sql`SELECT p.id, p.name, p.description,
              COALESCE(
                JSON_AGG(
                  JSON_BUILD_OBJECT('exercise', JSON_BUILD_OBJECT('id', e.id, 'name', e.name, 'sets', e.sets, 'reps', e.reps), 'order', epi."order", 'sets', epi.sets, 'reps', epi.reps)
                  ORDER BY epi."order"
                ) FILTER (WHERE epi.id IS NOT NULL), '[]'
              ) AS items
            FROM "ExerciseProgram" p
            LEFT JOIN "ExerciseProgramItem" epi ON epi."programId" = p.id
            LEFT JOIN "Exercise" e ON e.id = epi."exerciseId"
            WHERE p.name ILIKE ${like}
            GROUP BY p.id
            ORDER BY p."createdAt" DESC
            LIMIT 10 OFFSET ${offset}`,
      ]);
      setPrograms(rows as Program[]);
      setTotalPages(Math.max(1, Math.ceil((countRows[0] as { count: number }).count / 10)));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = setTimeout(fetchPrograms, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchPrograms, search]);

  useEffect(() => { setPage(1); }, [search]);

  useEffect(() => {
    sql`SELECT id, name, sets, reps FROM "Exercise" ORDER BY name`.then((rows: any) => setExercises(rows as Exercise[]));
  }, []);

  function openAdd() {
    setEditing(null); setFormName(""); setFormDesc(""); setFormItems([]); setSelectedExId(""); setNameError(""); setModalOpen(true);
  }

  function openEdit(p: Program) {
    setEditing(p);
    setFormName(p.name);
    setFormDesc(p.description || "");
    setFormItems(p.items.map((i) => ({ exerciseId: i.exercise.id, exerciseName: i.exercise.name, order: i.order, sets: i.sets, reps: i.reps })));
    setSelectedExId("");
    setNameError("");
    setModalOpen(true);
  }

  function addExerciseToList() {
    if (!selectedExId) return;
    const ex = exercises.find((e) => e.id === Number(selectedExId));
    if (!ex) return;
    if (formItems.some((i) => i.exerciseId === ex.id)) return;
    setFormItems([...formItems, { exerciseId: ex.id, exerciseName: ex.name, order: formItems.length, sets: ex.sets, reps: ex.reps }]);
    setSelectedExId("");
  }

  function removeItem(idx: number) {
    setFormItems(formItems.filter((_, i) => i !== idx).map((item, i) => ({ ...item, order: i })));
  }

  function moveItem(idx: number, dir: -1 | 1) {
    const newItems = [...formItems];
    const target = idx + dir;
    if (target < 0 || target >= newItems.length) return;
    [newItems[idx], newItems[target]] = [newItems[target], newItems[idx]];
    setFormItems(newItems.map((item, i) => ({ ...item, order: i })));
  }

  function updateItem(idx: number, field: "sets" | "reps", value: string) {
    const newItems = [...formItems];
    newItems[idx] = { ...newItems[idx], [field]: Number(value) || 1 };
    setFormItems(newItems);
  }

  async function handleSave() {
    if (!formName.trim()) { setNameError(t.validation.required); return; }
    setSaving(true);
    try {
      const description = formDesc || null;
      let programId: number;
      if (editing) {
        await sql`UPDATE "ExerciseProgram" SET name=${formName}, description=${description}, "updatedAt"=NOW() WHERE id=${editing.id}`;
        await sql`DELETE FROM "ExerciseProgramItem" WHERE "programId"=${editing.id}`;
        programId = editing.id;
      } else {
        const rows = await sql`INSERT INTO "ExerciseProgram" (name, description, "createdAt", "updatedAt") VALUES (${formName}, ${description}, NOW(), NOW()) RETURNING id`;
        programId = (rows[0] as { id: number }).id;
      }
      for (let idx = 0; idx < formItems.length; idx++) {
        const item = formItems[idx];
        await sql`INSERT INTO "ExerciseProgramItem" ("programId", "exerciseId", "order", sets, reps) VALUES (${programId}, ${item.exerciseId}, ${idx}, ${item.sets}, ${item.reps})`;
      }
      setModalOpen(false);
      setToast({ message: editing ? "Program updated" : "Program created", type: "success" });
      fetchPrograms();
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
      await sql`DELETE FROM "ExerciseProgram" WHERE id=${deleteTarget.id}`;
      setDeleteTarget(null);
      setToast({ message: "Program deleted", type: "success" });
      fetchPrograms();
    } catch {
      setToast({ message: t.common.error, type: "error" });
    } finally {
      setDeleting(false);
    }
  }

  const availableExercises = exercises.filter((e) => !formItems.some((i) => i.exerciseId === e.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t.programs.title}</h1>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ background: "#10b981" }}>
          <span>+</span> {t.programs.add}
        </button>
      </div>

      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.programs.search} className={inputCls} />

      {/* Program grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse h-36" />
        )) : programs.length === 0 ? (
          <div className="col-span-full"><EmptyState message={t.programs.empty} action={{ label: t.programs.add, onClick: openAdd }} /></div>
        ) : programs.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col gap-3">
            <div>
              <h3 className="font-semibold text-gray-900">{p.name}</h3>
              {p.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{p.description}</p>}
            </div>
            <div className="text-xs text-gray-500">
              {p.items.length} {t.programs.exerciseCount}
              {p.items.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {p.items.slice(0, 3).map((item) => (
                    <li key={item.exercise.id} className="text-gray-400">{item.exercise.name} · {item.sets}×{item.reps}</li>
                  ))}
                  {p.items.length > 3 && <li className="text-gray-300">+{p.items.length - 3} more</li>}
                </ul>
              )}
            </div>
            <div className="flex gap-2 mt-auto">
              <button onClick={() => openEdit(p)} className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">{t.common.edit}</button>
              <button onClick={() => setDeleteTarget(p)} className="text-xs px-2.5 py-1 rounded-md border border-red-200 text-red-500 hover:bg-red-50">{t.common.delete}</button>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t.programs.edit : t.programs.add} maxWidth="max-w-2xl">
        <div className="space-y-5">
          <FormField label={t.programs.name} error={nameError}>
            <input className={inputCls} value={formName} onChange={(e) => { setFormName(e.target.value); setNameError(""); }} />
          </FormField>
          <FormField label={t.programs.description} optional>
            <textarea rows={2} className={inputCls} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
          </FormField>

          {/* Exercise list */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">{t.programs.exercises}</p>
            {formItems.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">{t.programs.noExercises}</p>
            ) : (
              <div className="space-y-2">
                {formItems.map((item, idx) => (
                  <div key={item.exerciseId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30">▲</button>
                      <button onClick={() => moveItem(idx, 1)} disabled={idx === formItems.length - 1} className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30">▼</button>
                    </div>
                    <span className="text-xs text-gray-400 w-5 text-center">{idx + 1}</span>
                    <p className="flex-1 text-sm font-medium text-gray-800">{item.exerciseName}</p>
                    <input type="number" min="1" value={item.sets} onChange={(e) => updateItem(idx, "sets", e.target.value)} className="w-14 text-center text-sm border border-gray-200 rounded-md px-2 py-1" />
                    <span className="text-xs text-gray-400">×</span>
                    <input type="number" min="1" value={item.reps} onChange={(e) => updateItem(idx, "reps", e.target.value)} className="w-14 text-center text-sm border border-gray-200 rounded-md px-2 py-1" />
                    <button onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-500 transition-colors text-sm">✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Add exercise */}
            {availableExercises.length > 0 && (
              <div className="flex gap-2 mt-3">
                <select className={`${selectCls} flex-1`} value={selectedExId} onChange={(e) => setSelectedExId(e.target.value)}>
                  <option value="">{t.programs.selectExercise}</option>
                  {availableExercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <button onClick={addExerciseToList} disabled={!selectedExId} className="px-3 py-2 text-sm text-white rounded-lg disabled:opacity-40" style={{ background: "#10b981" }}>
                  {t.programs.addExercise}
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">{t.common.cancel}</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50" style={{ background: "#10b981" }}>
              {saving ? t.common.loading : t.programs.saveProgram}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title={t.programs.delete} message={t.programs.deleteConfirm} loading={deleting} />
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
