import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      sources: { orderBy: { createdAt: "asc" } },
      steps: { orderBy: { stepNumber: "asc" } },
      knowledgeEntries: {
        include: { source: { select: { name: true } } },
        orderBy: [{ area: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Parse JSON fields in steps
  const steps = campaign.steps.map((s) => ({
    ...s,
    knowledgeGaps: JSON.parse(s.knowledgeGaps),
    decisions: JSON.parse(s.decisions),
  }));

  // Add sourceName to knowledge entries
  const knowledgeEntries = campaign.knowledgeEntries.map((e) => ({
    ...e,
    sourceName: e.source?.name ?? null,
    source: undefined,
  }));

  return NextResponse.json({ ...campaign, steps, knowledgeEntries });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const body = await req.json();
  const allowed = ["name", "description", "status", "currentStep"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data,
  });

  return NextResponse.json(campaign);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  await prisma.campaign.delete({ where: { id: campaignId } });
  return NextResponse.json({ ok: true });
}
