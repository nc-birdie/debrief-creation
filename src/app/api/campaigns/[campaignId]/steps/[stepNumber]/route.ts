import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { KnowledgeGap, Decision } from "@/lib/types";

// Map gap categories to knowledge areas
const GAP_CATEGORY_TO_AREA: Record<string, string> = {
  source_needed: "other",
  research_needed: "market_context",
  decision_needed: "strategic_context",
};

export async function GET(
  _req: Request,
  {
    params,
  }: { params: Promise<{ campaignId: string; stepNumber: string }> }
) {
  const { campaignId, stepNumber } = await params;
  const step = await prisma.stepState.findUnique({
    where: {
      campaignId_stepNumber: {
        campaignId,
        stepNumber: parseInt(stepNumber, 10),
      },
    },
  });

  if (!step) {
    return NextResponse.json({ error: "Step not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...step,
    knowledgeGaps: JSON.parse(step.knowledgeGaps),
    decisions: JSON.parse(step.decisions),
  });
}

export async function PATCH(
  req: Request,
  {
    params,
  }: { params: Promise<{ campaignId: string; stepNumber: string }> }
) {
  const { campaignId, stepNumber } = await params;
  const stepNum = parseInt(stepNumber, 10);
  const mutation = await req.json();

  const step = await prisma.stepState.findUnique({
    where: { campaignId_stepNumber: { campaignId, stepNumber: stepNum } },
  });
  if (!step) {
    return NextResponse.json({ error: "Step not found" }, { status: 404 });
  }

  const gaps: KnowledgeGap[] = JSON.parse(step.knowledgeGaps);
  const decisions: Decision[] = JSON.parse(step.decisions);

  switch (mutation.type) {
    case "user-edit": {
      await prisma.stepState.update({
        where: { id: step.id },
        data: { userEdits: mutation.content },
      });
      // User notes are stored on the step but also feed into generation
      // via the step's finalOutput when approved — no separate knowledge entry needed
      break;
    }

    case "approve": {
      // Merge AI draft + user edits into final output
      const parts = [step.aiDraft, step.userEdits].filter(Boolean);
      const finalOutput = parts.join("\n\n---\n\n");
      await prisma.stepState.update({
        where: { id: step.id },
        data: {
          finalOutput,
          status: "approved",
          approvedAt: new Date(),
        },
      });
      // Advance campaign currentStep if this is the current step
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
      });
      if (campaign && campaign.currentStep === stepNum && stepNum < 13) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            currentStep: stepNum + 1,
            status: "in_progress",
          },
        });
      } else if (campaign && stepNum === 13) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: "completed" },
        });
      }
      break;
    }

    case "resolve-gap": {
      const gap = gaps.find((g) => g.id === mutation.gapId);
      if (gap) {
        gap.resolved = true;
        gap.resolution = mutation.resolution;

        // Save resolution as a knowledge entry in program context
        await prisma.knowledgeEntry.create({
          data: {
            campaignId,
            area: GAP_CATEGORY_TO_AREA[gap.category] ?? "other",
            title: gap.title,
            content: mutation.resolution,
          },
        });
      }
      await prisma.stepState.update({
        where: { id: step.id },
        data: { knowledgeGaps: JSON.stringify(gaps) },
      });
      break;
    }

    case "dismiss-gap": {
      const filtered = gaps.filter((g) => g.id !== mutation.gapId);
      await prisma.stepState.update({
        where: { id: step.id },
        data: { knowledgeGaps: JSON.stringify(filtered) },
      });
      break;
    }

    case "decide": {
      const decision = decisions.find((d) => d.id === mutation.decisionId);
      if (decision) {
        decision.chosen = mutation.chosen;

        // Save decision as a knowledge entry in program context
        await prisma.knowledgeEntry.create({
          data: {
            campaignId,
            area: "strategic_context",
            title: `Decision: ${decision.title}`,
            content: `${decision.description}\n\nChosen: ${mutation.chosen}${decision.reasoning ? `\nReasoning: ${decision.reasoning}` : ""}`,
          },
        });
      }
      await prisma.stepState.update({
        where: { id: step.id },
        data: { decisions: JSON.stringify(decisions) },
      });
      break;
    }

    default:
      return NextResponse.json(
        { error: "Unknown mutation type" },
        { status: 400 }
      );
  }

  // Return updated step
  const updated = await prisma.stepState.findUnique({
    where: { id: step.id },
  });

  return NextResponse.json({
    ...updated,
    knowledgeGaps: JSON.parse(updated!.knowledgeGaps),
    decisions: JSON.parse(updated!.decisions),
  });
}
