import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BRIEFING_FRAMEWORK } from "@/lib/briefing-questions";

// GET all categories with questions. Seeds defaults on first call.
export async function GET() {
  let categories = await prisma.briefingCategory.findMany({
    include: {
      questions: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { sortOrder: "asc" },
  });

  // Auto-seed if empty
  if (categories.length === 0) {
    for (let i = 0; i < BRIEFING_FRAMEWORK.length; i++) {
      const cat = BRIEFING_FRAMEWORK[i];
      await prisma.briefingCategory.create({
        data: {
          label: cat.label,
          sortOrder: i,
          questions: {
            create: cat.questions.map((q, j) => ({
              question: q.question,
              sortOrder: j,
            })),
          },
        },
      });
    }

    categories = await prisma.briefingCategory.findMany({
      include: {
        questions: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { sortOrder: "asc" },
    });
  }

  return NextResponse.json(categories);
}
