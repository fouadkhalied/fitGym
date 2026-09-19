import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const itemSchema = z.object({
  exerciseId: z.number().int().positive(),
  order: z.number().int(),
  sets: z.coerce.number().int().positive(),
  reps: z.coerce.number().int().positive(),
});

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  items: z.array(itemSchema).optional().default([]),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const program = await prisma.exerciseProgram.findUnique({
    where: { id: Number(id) },
    include: { items: { include: { exercise: true }, orderBy: { order: "asc" } } },
  });
  if (!program) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(program);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const result = schema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const { name, description, items } = result.data;
  await prisma.exerciseProgramItem.deleteMany({ where: { programId: Number(id) } });
  const program = await prisma.exerciseProgram.update({
    where: { id: Number(id) },
    data: {
      name,
      description: description || null,
      items: {
        create: items.map((item) => ({
          exerciseId: item.exerciseId,
          order: item.order,
          sets: item.sets,
          reps: item.reps,
        })),
      },
    },
    include: { items: { include: { exercise: true }, orderBy: { order: "asc" } } },
  });
  return NextResponse.json(program);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.exerciseProgram.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
