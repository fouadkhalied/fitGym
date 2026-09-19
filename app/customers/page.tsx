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
import Link from "next/link";

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  age: number | null;
  gender: string | null;
  notes: string | null;
}

const PAGE_SIZE = 10;
const emptyForm = { name: "", phone: "", email: "", age: "", gender: "", notes: "" };

export default function CustomersPage() {
  const { t } = useI18n();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const like = `%${search}%`;
      const offset = (page - 1) * PAGE_SIZE;
      const [countRows, rows] = await Promise.all([
        sql`SELECT COUNT(*)::int AS count FROM "Customer" WHERE name ILIKE ${like} OR phone ILIKE ${like}`,
        sql`SELECT id, name, phone, email, age, gender, notes FROM "Customer"
            WHERE name ILIKE ${like} OR phone ILIKE ${like}
            ORDER BY "createdAt" DESC LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
      ]);
      const total = (countRows[0] as { count: number }).count;
      setCustomers(rows as Customer[]);
      setTotalPages(Math.max(1, Math.ceil(total / PAGE_SIZE)));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = setTimeout(fetchCustomers, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchCustomers, search]);

  useEffect(() => { setPage(1); }, [search]);

  function openAdd() { setEditing(null); setForm(emptyForm); setErrors({}); setModalOpen(true); }
  function openEdit(c: Customer) {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, email: c.email || "", age: c.age?.toString() || "", gender: c.gender || "", notes: c.notes || "" });
    setErrors({});
    setModalOpen(true);
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t.validation.required;
    if (!form.phone.trim()) e.phone = t.validation.required;
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = t.validation.invalidEmail;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const age = form.age ? Number(form.age) : null;
      const email = form.email || null;
      const gender = form.gender || null;
      const notes = form.notes || null;
      if (editing) {
        await sql`UPDATE "Customer" SET name=${form.name}, phone=${form.phone}, email=${email}, age=${age}, gender=${gender}, notes=${notes}, "updatedAt"=NOW() WHERE id=${editing.id}`;
      } else {
        await sql`INSERT INTO "Customer" (name, phone, email, age, gender, notes, "createdAt", "updatedAt") VALUES (${form.name}, ${form.phone}, ${email}, ${age}, ${gender}, ${notes}, NOW(), NOW())`;
      }
      setModalOpen(false);
      setToast({ message: editing ? "Customer updated" : "Customer added", type: "success" });
      fetchCustomers();
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
      await sql`DELETE FROM "Customer" WHERE id=${deleteTarget.id}`;
      setDeleteTarget(null);
      setToast({ message: "Customer deleted", type: "success" });
      fetchCustomers();
    } catch {
      setToast({ message: t.common.error, type: "error" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t.customers.title}</h1>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ background: "#10b981" }}>
          <span>+</span> {t.customers.add}
        </button>
      </div>

      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.customers.search} className={inputCls} />

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
              <th className="px-5 py-3 text-start font-medium">{t.customers.name}</th>
              <th className="px-5 py-3 text-start font-medium">{t.customers.phone}</th>
              <th className="px-5 py-3 text-start font-medium">{t.customers.email}</th>
              <th className="px-5 py-3 text-start font-medium">{t.customers.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 4 }).map((_, j) => <td key={j} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
                ))
              : customers.length === 0
              ? <tr><td colSpan={4}><EmptyState message={t.customers.empty} action={{ label: t.customers.add, onClick: openAdd }} /></td></tr>
              : customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4 font-medium text-gray-900">{c.name}</td>
                    <td className="px-5 py-4 text-gray-500">{c.phone}</td>
                    <td className="px-5 py-4 text-gray-500">{c.email || "—"}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Link href={`/customers/${c.id}`} className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">{t.customers.view}</Link>
                        <button onClick={() => openEdit(c)} className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">{t.common.edit}</button>
                        <button onClick={() => setDeleteTarget(c)} className="text-xs px-2.5 py-1 rounded-md border border-red-200 text-red-500 hover:bg-red-50">{t.common.delete}</button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-1/2 mb-2" /><div className="h-3 bg-gray-100 rounded w-1/3" /></div>)
          : customers.length === 0
          ? <EmptyState message={t.customers.empty} action={{ label: t.customers.add, onClick: openAdd }} />
          : customers.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{c.phone}</p>
                    {c.email && <p className="text-xs text-gray-400 mt-0.5">{c.email}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Link href={`/customers/${c.id}`} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600">{t.customers.view}</Link>
                    <button onClick={() => openEdit(c)} className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600">{t.common.edit}</button>
                    <button onClick={() => setDeleteTarget(c)} className="text-xs px-2 py-1 rounded border border-red-200 text-red-500">{t.common.delete}</button>
                  </div>
                </div>
              </div>
            ))}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t.customers.edit : t.customers.add}>
        <div className="space-y-4">
          <FormField label={t.customers.name} error={errors.name}>
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label={t.customers.phone} error={errors.phone}>
            <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </FormField>
          <FormField label={t.customers.email} optional error={errors.email}>
            <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t.customers.age} optional>
              <input type="number" className={inputCls} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            </FormField>
            <FormField label={t.customers.gender} optional>
              <select className={selectCls} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">—</option>
                <option value="male">{t.customers.male}</option>
                <option value="female">{t.customers.female}</option>
                <option value="other">{t.customers.other}</option>
              </select>
            </FormField>
          </div>
          <FormField label={t.customers.notes} optional>
            <textarea rows={3} className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </FormField>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">{t.common.cancel}</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50" style={{ background: "#10b981" }}>
              {saving ? t.common.loading : t.common.save}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title={t.customers.delete} message={t.customers.deleteConfirm} loading={deleting} />
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
