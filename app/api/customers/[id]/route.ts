import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  age: z.coerce.number().int().positive().optional().nullable(),
  gender: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id: Number(id) },
    include: {
      assignments: {
        include: {
          program: { select: { id: true, name: true } },
          exercise: { select: { id: true, name: true, sets: true, reps: true } },
        },
        orderBy: { assignedAt: "desc" },
      },
    },
  });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(customer);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const result = customerSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const data = result.data;
  const customer = await prisma.customer.update({
    where: { id: Number(id) },
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      age: data.age ?? null,
      gender: data.gender || null,
      notes: data.notes || null,
    },
  });
  return NextResponse.json(customer);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.customer.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
