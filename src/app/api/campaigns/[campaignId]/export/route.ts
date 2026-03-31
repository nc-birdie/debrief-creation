import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/campaigns/[campaignId]/export
 * Exports all approved steps as a single markdown document.
 * Query params:
 *   ?step=5  — export only step 5
 *   (no param) — export all approved steps
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const url = new URL(req.url);
  const stepParam = url.searchParams.get("step");

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      steps: { orderBy: { stepNumber: "asc" } },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch step definitions for titles
  const stepDefs = await prisma.stepDef.findMany({
    orderBy: { number: "asc" },
  });
  const defMap = new Map(stepDefs.map((d) => [d.number, d]));

  // Single step export
  if (stepParam) {
    const stepNumber = parseInt(stepParam, 10);
    const step = campaign.steps.find((s) => s.stepNumber === stepNumber);
    if (!step) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 });
    }

    const def = defMap.get(stepNumber);
    const title = def?.title ?? `Step ${stepNumber}`;
    const shortTitle = def?.shortTitle ?? `Step ${stepNumber}`;

    const content = step.finalOutput || step.aiDraft || "";
    const md = `# Step ${stepNumber}: ${title}\n\n${content}\n`;

    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${campaign.slug}-step-${stepNumber}-${slugify(shortTitle)}.md"`,
      },
    });
  }

  // Full campaign export — all steps that have output
  const lines: string[] = [
    `# ${campaign.name}`,
    "",
    `> Exported ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
    "",
    "---",
    "",
  ];

  for (const step of campaign.steps) {
    const def = defMap.get(step.stepNumber);
    const title = def?.title ?? `Step ${step.stepNumber}`;
    const content = step.finalOutput || step.aiDraft;

    if (!content) continue;

    const statusTag = step.status === "approved" ? "" : ` *(${step.status})*`;
    lines.push(`## Step ${step.stepNumber}: ${title}${statusTag}`);
    lines.push("");
    lines.push(content);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  const md = lines.join("\n");

  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${campaign.slug}-full-export.md"`,
    },
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
