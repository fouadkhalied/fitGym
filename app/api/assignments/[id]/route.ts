import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  customerId: z.coerce.number().int().positive(),
  programId: z.coerce.number().int().positive().optional().nullable(),
  exerciseId: z.coerce.number().int().positive().optional().nullable(),
  sets: z.coerce.number().int().positive().optional().nullable(),
  reps: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
}).refine((d) => d.programId || d.exerciseId, {
  message: "Either programId or exerciseId is required",
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const result = schema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const data = result.data;
  const assignment = await prisma.assignment.update({
    where: { id: Number(id) },
    data: {
      customerId: data.customerId,
      programId: data.programId ?? null,
      exerciseId: data.exerciseId ?? null,
      sets: data.sets ?? null,
      reps: data.reps ?? null,
      notes: data.notes ?? null,
    },
    include: {
      customer: { select: { name: true } },
      program: { select: { name: true } },
      exercise: { select: { name: true } },
    },
  });
  return NextResponse.json(assignment);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.assignment.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
