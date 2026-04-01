import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeStepDef } from "@/lib/steps/definitions";
import { getAreaLabel } from "@/lib/knowledge-areas";

/**
 * POST /api/campaigns/[campaignId]/generate-all
 * Body: { refine?: boolean }
 *
 * Triggers generation for ALL enabled steps in parallel.
 * In refine mode, updates existing drafts based on gap resolutions and decisions.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;

  let refineMode = false;
  try {
    const body = await req.json();
    if (body.refine) refineMode = true;
  } catch { /* no body */ }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Load all enabled step definitions
  const stepDefRows = await prisma.stepDef.findMany({
    where: { enabled: true },
    orderBy: { number: "asc" },
  });
  const stepDefs = stepDefRows.map(serializeStepDef);

  // Load all step states — create any missing ones
  const existingStepStates = await prisma.stepState.findMany({
    where: { campaignId },
    orderBy: { stepNumber: "asc" },
  });
  const existingNums = new Set(existingStepStates.map((s) => s.stepNumber));
  const missingDefs = stepDefs.filter((d) => !existingNums.has(d.number));
  if (missingDefs.length > 0) {
    await Promise.all(
      missingDefs.map((d) =>
        prisma.stepState.create({
          data: { campaignId, stepNumber: d.number, status: "pending" },
        })
      )
    );
  }
  const stepStates = missingDefs.length > 0
    ? await prisma.stepState.findMany({ where: { campaignId }, orderBy: { stepNumber: "asc" } })
    : existingStepStates;

  // Load program context
  const knowledgeEntries = await prisma.knowledgeEntry.findMany({
    where: { campaignId },
    orderBy: [{ area: "asc" }, { createdAt: "asc" }],
  });

  const entriesByArea = new Map<string, typeof knowledgeEntries>();
  for (const entry of knowledgeEntries) {
    const list = entriesByArea.get(entry.area) ?? [];
    list.push(entry);
    entriesByArea.set(entry.area, list);
  }
  const programContext = Array.from(entriesByArea.entries())
    .map(([area, entries]) => {
      const items = entries.map((e) => `- **${e.title}**: ${e.content}`).join("\n");
      return `### ${getAreaLabel(area)}\n${items}`;
    })
    .join("\n\n");

  const stepTitleMap = new Map(stepDefRows.map((s) => [s.number, s.title]));

  // Mark all steps as generating
  await prisma.stepState.updateMany({
    where: {
      campaignId,
      stepNumber: { in: stepDefs.map((d) => d.number) },
    },
    data: { status: "generating" },
  });

  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  // Generate all steps in parallel
  const results = await Promise.all(
    stepDefs.map(async (stepDef) => {
      const step = stepStates.find((s) => s.stepNumber === stepDef.number);
      if (!step) return { stepNumber: stepDef.number, status: "error" as const, error: "No step state" };

      try {
        // Build system prompt (shared context + step-specific instructions)
        const systemPrompt = [
          `You are a B2B marketing strategist helping set campaign direction for "${campaign.name}".`,
          campaign.description ? `\nContext: ${campaign.description}` : "",
          programContext
            ? `\n\n== PROGRAM CONTEXT ==\n${programContext}`
            : "",
          stepDef.customInstructions
            ? `\n\n== ADDITIONAL INSTRUCTIONS ==\n${stepDef.customInstructions}`
            : "",
          `\n\nYou MUST surface knowledge gaps and decision points. For any information you cannot determine from the program context, flag it as a knowledge gap. For any strategic choice needing human judgment, flag it as a decision point.`,
        ].filter(Boolean).join("");

        let userPrompt: string;

        if (refineMode && step.aiDraft) {
          const existingGaps = JSON.parse(step.knowledgeGaps || "[]");
          const existingDecisions = JSON.parse(step.decisions || "[]");

          const resolvedGaps = existingGaps
            .filter((g: { resolved: boolean; resolution?: string }) => g.resolved && g.resolution)
            .map((g: { title: string; resolution: string }) => `- **${g.title}**: ${g.resolution}`)
            .join("\n");

          const madeDecisions = existingDecisions
            .filter((d: { chosen?: string }) => d.chosen && d.chosen !== "__DEFERRED__")
            .map((d: { title: string; chosen: string }) => `- **${d.title}**: ${d.chosen}`)
            .join("\n");

          userPrompt = [
            `Refine the existing draft for Step ${stepDef.number}: "${stepDef.title}"`,
            `\n\n== CURRENT DRAFT ==\n${step.aiDraft}`,
            resolvedGaps ? `\n\n== NEW INFORMATION (from resolved knowledge gaps) ==\n${resolvedGaps}` : "",
            madeDecisions ? `\n\n== DECISIONS MADE ==\n${madeDecisions}` : "",
            step.userEdits ? `\n\n== USER NOTES ==\n${step.userEdits}` : "",
            `\n\nUpdate the draft to incorporate the new information and decisions. Keep what's still valid. Only change affected sections.`,
            stepDef.outputFormat ? `\n\nExpected output format: ${stepDef.outputFormat}` : "",
            `\n\nReturn JSON: { "draft": "...", "knowledgeGaps": [...], "decisions": [...] }`,
            `\nOnly include NEW or REMAINING gaps/decisions. Do not re-include resolved ones.`,
          ].join("");
        } else {
          userPrompt = [
            `Generate a comprehensive draft for Step ${stepDef.number}: "${stepDef.title}"`,
            `\n\n${stepDef.description}`,
            `\n\n${stepDef.promptHint}`,
            stepDef.outputFormat ? `\n\nExpected output format: ${stepDef.outputFormat}` : "",
            `\n\nReturn your response as JSON with this structure:`,
            `{ "draft": "Your markdown content...", "knowledgeGaps": [{ "id": "gap-1", "title": "...", "description": "...", "category": "source_needed|research_needed|decision_needed", "resolved": false }], "decisions": [{ "id": "dec-1", "title": "...", "description": "...", "options": ["A","B","C"], "recommendation": "A", "reasoning": "..." }] }`,
          ].join("");
        }

        let agentResult = "";
        for await (const message of query({
          prompt: userPrompt,
          options: {
            systemPrompt,
            allowedTools: stepDef.allowedTools,
            permissionMode: "acceptEdits",
            maxTurns: stepDef.maxTurns,
          },
        })) {
          if ("result" in message) {
            agentResult = message.result;
          }
        }

        const result = extractJson(agentResult);

        await prisma.stepState.update({
          where: { id: step.id },
          data: {
            aiDraft: result.draft,
            knowledgeGaps: JSON.stringify(result.knowledgeGaps),
            decisions: JSON.stringify(result.decisions),
            status: "review",
            generatedAt: new Date(),
          },
        });

        return { stepNumber: stepDef.number, status: "ok" as const };
      } catch (err) {
        await prisma.stepState.update({
          where: { id: step.id },
          data: { status: "pending" },
        });
        console.error(`Step ${stepDef.number} generation failed:`, err);
        return { stepNumber: stepDef.number, status: "error" as const, error: String(err) };
      }
    })
  );

  // Auto-save exports to data/ for git
  try {
    const saveUrl = new URL(`/api/campaigns/${campaignId}/export`, req.url);
    await fetch(saveUrl.toString(), { method: "POST" });
  } catch { /* non-fatal */ }

  return NextResponse.json({
    completed: results.filter((r) => r.status === "ok").length,
    failed: results.filter((r) => r.status === "error").length,
    results,
  });
}

function extractJson(text: string) {
  const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch { /* next */ }
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch { /* fallback */ }
  }
  return { draft: text, knowledgeGaps: [], decisions: [] };
}
