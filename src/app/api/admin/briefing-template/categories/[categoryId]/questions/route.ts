import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Add question to category
export async function POST(
  req: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await params;
  const body = await req.json();

  if (!body.question?.trim()) {
    return NextResponse.json(
      { error: "question is required" },
      { status: 400 }
    );
  }

  const maxOrder = await prisma.briefingTemplateQuestion.aggregate({
    where: { categoryId },
    _max: { sortOrder: true },
  });

  const question = await prisma.briefingTemplateQuestion.create({
    data: {
      categoryId,
      question: body.question.trim(),
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(question, { status: 201 });
}
