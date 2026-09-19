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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") || 10)));
  const search = searchParams.get("search") || "";
  const customerId = searchParams.get("customerId");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (customerId) where.customerId = Number(customerId);
  if (type === "program") where.programId = { not: null };
  if (type === "exercise") where.exerciseId = { not: null };
  if (search) {
    where.OR = [
      { customer: { name: { contains: search } } },
      { program: { name: { contains: search } } },
      { exercise: { name: { contains: search } } },
    ];
  }

  const [items, totalItems] = await Promise.all([
    prisma.assignment.findMany({
      where,
      orderBy: { assignedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { id: true, name: true } },
        program: { select: { id: true, name: true, items: true } },
        exercise: { select: { id: true, name: true, sets: true, reps: true } },
      },
    }),
    prisma.assignment.count({ where }),
  ]);
  return NextResponse.json({ items, page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = schema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const data = result.data;
  const assignment = await prisma.assignment.create({
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
  return NextResponse.json(assignment, { status: 201 });
}
