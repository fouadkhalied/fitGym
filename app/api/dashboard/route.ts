import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [totalCustomers, totalExercises, totalPrograms, totalAssignments, recentCustomers, recentAssignments] =
      await Promise.all([
        prisma.customer.count(),
        prisma.exercise.count(),
        prisma.exerciseProgram.count(),
        prisma.assignment.count(),
        prisma.customer.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
        prisma.assignment.findMany({
          orderBy: { assignedAt: "desc" },
          take: 5,
          include: {
            customer: { select: { name: true } },
            program: { select: { name: true } },
            exercise: { select: { name: true } },
          },
        }),
      ]);

    return NextResponse.json({
      stats: { totalCustomers, totalExercises, totalPrograms, totalAssignments },
      recentCustomers,
      recentAssignments,
    });
  } catch {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
