import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  sets: z.coerce.number().int().positive().default(3),
  reps: z.coerce.number().int().positive().default(10),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const result = schema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  const exercise = await prisma.exercise.update({ where: { id: Number(id) }, data: result.data });
  return NextResponse.json(exercise);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.exercise.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
