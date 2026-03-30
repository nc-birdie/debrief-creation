import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Create a new category
export async function POST(req: Request) {
  const body = await req.json();

  if (!body.label?.trim()) {
    return NextResponse.json(
      { error: "label is required" },
      { status: 400 }
    );
  }

  const maxOrder = await prisma.briefingCategory.aggregate({
    _max: { sortOrder: true },
  });

  const category = await prisma.briefingCategory.create({
    data: {
      label: body.label.trim(),
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
    include: { questions: true },
  });

  return NextResponse.json(category, { status: 201 });
}
