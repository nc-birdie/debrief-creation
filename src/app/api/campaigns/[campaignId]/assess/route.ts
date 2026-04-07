import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { BriefAssessment, CoverageStatus } from "@/lib/types";
import { runAssessment } from "@/lib/assess";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;

  let deltaEntryIds: string[] | null = null;
  try {
    const body = await req.json();
    if (body.deltaEntryIds && Array.isArray(body.deltaEntryIds)) {
      deltaEntryIds = body.deltaEntryIds;
    }
  } catch { /* no body = full assessment */ }

  const assessment = await runAssessment(campaignId, deltaEntryIds);
  return NextResponse.json(assessment);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const body = await req.json();
  const { categoryId, questionId, evidence, status } = body;

  if (!categoryId || !questionId || typeof evidence !== "string") {
    return NextResponse.json(
      { error: "categoryId, questionId, and evidence are required" },
      { status: 400 }
    );
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { briefAssessment: true },
  });

  if (!campaign?.briefAssessment) {
    return NextResponse.json({ error: "No assessment found" }, { status: 404 });
  }

  const assessment: BriefAssessment = JSON.parse(campaign.briefAssessment);

  let catAssessment = assessment.categories.find((c) => c.categoryId === categoryId);
  if (!catAssessment) {
    const catIndex = parseInt(categoryId, 10);
    if (!isNaN(catIndex) && catIndex >= 0 && catIndex < assessment.categories.length) {
      catAssessment = assessment.categories[catIndex];
    }
  }
  if (!catAssessment) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const question = catAssessment.questions.find((q) => q.questionId === questionId);
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  question.evidence = evidence;
  if (status && ["covered", "partial", "gap"].includes(status)) {
    question.status = status as CoverageStatus;
  } else if (evidence.trim().length > 0 && question.status === "gap") {
    question.status = "partial";
  }

  let total = 0, covered = 0;
  for (const cat of assessment.categories) {
    for (const q of cat.questions) { total++; if (q.status === "covered") covered++; }
  }
  assessment.overallScore = total > 0 ? Math.round((covered / total) * 100) : 0;

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { briefAssessment: JSON.stringify(assessment) },
  });

  return NextResponse.json(assessment);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { briefAssessment: true },
  });
  if (!campaign?.briefAssessment) return NextResponse.json(null);
  return NextResponse.json(JSON.parse(campaign.briefAssessment));
}
