import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  sets: z.coerce.number().int().positive().default(3),
  reps: z.coerce.number().int().positive().default(10),
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
    const items = await prisma.exercise.findMany({ where, orderBy: { name: "asc" } });
    return NextResponse.json({ items });
  }

  const [items, totalItems] = await Promise.all([
    prisma.exercise.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.exercise.count({ where }),
  ]);
  return NextResponse.json({ items, page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = schema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  const exercise = await prisma.exercise.create({ data: result.data });
  return NextResponse.json(exercise, { status: 201 });
}
