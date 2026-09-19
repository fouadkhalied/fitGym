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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize") || 10)));
  const search = searchParams.get("search") || "";
  const all = searchParams.get("all") === "1";

  const where = search
    ? { OR: [{ name: { contains: search } }, { description: { contains: search } }] }
    : {};

  if (all) {
    const items = await prisma.exerciseProgram.findMany({
      where,
      orderBy: { name: "asc" },
      include: { items: true },
    });
    return NextResponse.json({ items });
  }

  const [items, totalItems] = await Promise.all([
    prisma.exerciseProgram.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { items: { include: { exercise: true }, orderBy: { order: "asc" } } },
    }),
    prisma.exerciseProgram.count({ where }),
  ]);
  return NextResponse.json({ items, page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = schema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const { name, description, items } = result.data;
  const program = await prisma.exerciseProgram.create({
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
  return NextResponse.json(program, { status: 201 });
}
