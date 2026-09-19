"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Assignment {
  id: number;
  program: { id: number; name: string } | null;
  exercise: { id: number; name: string; sets: number; reps: number } | null;
  sets: number | null;
  reps: number | null;
  notes: string | null;
  assignedAt: string;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  age: number | null;
  gender: string | null;
  notes: string | null;
  createdAt: string;
  assignments: Assignment[];
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/customers/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then((data) => { if (data) { setCustomer(data); setLoading(false); } });
  }, [id]);

  if (loading) return <div className="text-gray-400 text-sm p-8">{t.common.loading}</div>;
  if (notFound) return <div className="text-gray-400 text-sm p-8">Customer not found.</div>;
  if (!customer) return null;

  const programAssignments = customer.assignments.filter((a) => a.program);
  const exerciseAssignments = customer.assignments.filter((a) => !a.program && a.exercise);

  const field = (label: string, value: string | number | null | undefined) =>
    value ? (
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

        {/* Programs */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">{t.customers.assignedPrograms}</h2>
          {programAssignments.length === 0 ? (
            <p className="text-sm text-gray-400">{t.customers.noPrograms}</p>
          ) : (
            <ul className="space-y-2">
              {programAssignments.map((a) => (
                <li key={a.id} className="flex items-center gap-2 p-3 rounded-lg bg-gray-50">
                  <span className="text-base">📋</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.program?.name}</p>
                    <p className="text-xs text-gray-400">{new Date(a.assignedAt).toLocaleDateString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Exercises */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">{t.customers.individualExercises}</h2>
          {exerciseAssignments.length === 0 ? (
            <p className="text-sm text-gray-400">{t.customers.noExercises}</p>
          ) : (
            <ul className="space-y-2">
              {exerciseAssignments.map((a) => (
                <li key={a.id} className="flex items-center gap-2 p-3 rounded-lg bg-gray-50">
                  <span className="text-base">💪</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.exercise?.name}</p>
                    <p className="text-xs text-gray-500">
                      {(a.sets ?? a.exercise?.sets) ?? "?"} × {(a.reps ?? a.exercise?.reps) ?? "?"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
