import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeStepDef } from "@/lib/steps/definitions";
import { getAreaLabel } from "@/lib/knowledge-areas";

export async function POST(
  req: Request,
  {
    params,
  }: { params: Promise<{ campaignId: string; stepNumber: string }> }
) {
  const { campaignId, stepNumber } = await params;
  const stepNum = parseInt(stepNumber, 10);

  // Parse optional additional context from request body
  let additionalContext = "";
  try {
    const body = await req.json();
    if (body.additionalContext) additionalContext = body.additionalContext;
  } catch {
    // No body or not JSON — that's fine
  }

  // Load step definition from DB
  const stepDefRow = await prisma.stepDef.findUnique({
    where: { number: stepNum },
  });
  if (!stepDefRow) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }
  const stepDef = serializeStepDef(stepDefRow);

  // Mark step as generating
  const step = await prisma.stepState.findUnique({
    where: {
      campaignId_stepNumber: { campaignId, stepNumber: stepNum },
    },
  });
  if (!step) {
    return NextResponse.json({ error: "Step not found" }, { status: 404 });
  }

  await prisma.stepState.update({
    where: { id: step.id },
    data: { status: "generating" },
  });

  try {
    // Gather knowledge entries (program context)
    const knowledgeEntries = await prisma.knowledgeEntry.findMany({
      where: { campaignId },
      orderBy: [{ area: "asc" }, { createdAt: "asc" }],
    });

    // Gather prior step outputs based on dependency graph
    const priorSteps = stepDef.dependsOn.length > 0
      ? await prisma.stepState.findMany({
          where: {
            campaignId,
            stepNumber: { in: stepDef.dependsOn },
            finalOutput: { not: null },
          },
        })
      : [];

    // Build program context grouped by area
    const entriesByArea = new Map<string, typeof knowledgeEntries>();
    for (const entry of knowledgeEntries) {
      const list = entriesByArea.get(entry.area) ?? [];
      list.push(entry);
      entriesByArea.set(entry.area, list);
    }
    const programContext = Array.from(entriesByArea.entries())
      .map(([area, entries]) => {
        const items = entries
          .map((e) => `- **${e.title}**: ${e.content}`)
          .join("\n");
        return `### ${getAreaLabel(area)}\n${items}`;
      })
      .join("\n\n");

    // Load all step defs for title lookup
    const allStepDefs = await prisma.stepDef.findMany();
    const stepTitleMap = new Map(allStepDefs.map((s) => [s.number, s.title]));

    const priorOutputs = priorSteps
      .map((ps) => {
        return `### Step ${ps.stepNumber}: ${stepTitleMap.get(ps.stepNumber) ?? ""}\n${ps.finalOutput}`;
      })
      .join("\n\n");

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    // Build system prompt
    const systemPrompt = [
      `You are a B2B marketing strategist helping set campaign direction for "${campaign?.name ?? ""}".`,
      campaign?.description ? `\nContext: ${campaign.description}` : "",
      programContext
        ? `\n\n== PROGRAM CONTEXT ==\nThe following knowledge has been extracted from source documents and organized by area:\n\n${programContext}`
        : "",
      priorOutputs
        ? `\n\n== PRIOR STEP OUTPUTS ==\n${priorOutputs}`
        : "",
      stepDef.customInstructions
        ? `\n\n== ADDITIONAL INSTRUCTIONS ==\n${stepDef.customInstructions}`
        : "",
      `\n\nYou MUST surface knowledge gaps and decision points. For any information you cannot determine from the program context, flag it as a knowledge gap. For any strategic choice needing human judgment, flag it as a decision point.`,
    ]
      .filter(Boolean)
      .join("");

    // Build user prompt
    const userPrompt = [
      `Generate a comprehensive draft for Step ${stepNum}: "${stepDef.title}"`,
      `\n\n${stepDef.description}`,
      `\n\n${stepDef.promptHint}`,
      additionalContext
        ? `\n\n== ADDITIONAL CONTEXT FROM USER ==\n${additionalContext}`
        : "",
      stepDef.outputFormat
        ? `\n\nExpected output format: ${stepDef.outputFormat}`
        : "",
      `\n\nReturn your response as JSON with this structure:`,
      `{`,
      `  "draft": "Your markdown content here...",`,
      `  "knowledgeGaps": [{ "id": "gap-1", "title": "...", "description": "...", "category": "source_needed|research_needed|decision_needed", "resolved": false }],`,
      `  "decisions": [{ "id": "dec-1", "title": "...", "description": "...", "options": ["A","B","C"], "recommendation": "A", "reasoning": "..." }]`,
      `}`,
    ].join("");

    // Try to use Claude Agent SDK
    let result: {
      draft: string;
      knowledgeGaps: Array<{
        id: string;
        title: string;
        description: string;
        category: string;
        resolved: boolean;
      }>;
      decisions: Array<{
        id: string;
        title: string;
        description: string;
        options: string[];
        recommendation: string;
        reasoning: string;
      }>;
    };

    try {
      const { query } = await import("@anthropic-ai/claude-agent-sdk");

      const allowedTools = stepDef.allowedTools;

      let agentResult = "";

      // Create agent run record
      const agentRun = await prisma.agentRun.create({
        data: {
          campaignId,
          stepNumber: stepNum,
          phase: "generate",
          status: "running",
          systemPrompt,
          prompt: userPrompt,
          startedAt: new Date(),
        },
      });

      let turnCount = 0;
      for await (const message of query({
        prompt: userPrompt,
        options: {
          systemPrompt,
          allowedTools,
          permissionMode: "acceptEdits",
          maxTurns: stepDef.maxTurns,
        },
      })) {
        if ("result" in message) {
          agentResult = message.result;
        }
        if ("role" in message && message.role === "assistant") {
          turnCount++;
          const msg = message as Record<string, unknown>;
          await prisma.agentMessage.create({
            data: {
              runId: agentRun.id,
              role: "assistant",
              content:
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg.content),
              turnNumber: turnCount,
            },
          });
        }
      }

      // Update agent run
      await prisma.agentRun.update({
        where: { id: agentRun.id },
        data: {
          status: "completed",
          result: agentResult,
          turnsUsed: turnCount,
          completedAt: new Date(),
        },
      });

      // Extract JSON from result
      result = extractJson(agentResult);
    } catch {
      // Fallback: generate a placeholder
      result = {
        draft: `# Step ${stepNum}: ${stepDef.title}\n\n*AI generation requires Claude Agent SDK. Please ensure you have the Claude CLI installed and authenticated.*\n\n${stepDef.description}`,
        knowledgeGaps: [
          {
            id: "gap-auto-1",
            title: "Source material needed",
            description:
              "Upload and ingest source documents to enable AI-powered generation for this step.",
            category: "source_needed",
            resolved: false,
          },
        ],
        decisions: [],
      };
    }

    // Update step state
    const updated = await prisma.stepState.update({
      where: { id: step.id },
      data: {
        aiDraft: result.draft,
        knowledgeGaps: JSON.stringify(result.knowledgeGaps),
        decisions: JSON.stringify(result.decisions),
        status: "review",
        generatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ...updated,
      knowledgeGaps: result.knowledgeGaps,
      decisions: result.decisions,
    });
  } catch (err) {
    // Reset status on failure
    await prisma.stepState.update({
      where: { id: step.id },
      data: { status: "pending" },
    });
    console.error("Generation failed:", err);
    return NextResponse.json(
      { error: "Generation failed" },
      { status: 500 }
    );
  }
}

function extractJson(text: string) {
  // Try markdown code fence first
  const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch { /* try next */ }
  }
  // Try raw JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch { /* fallback */ }
  }
  // Fallback: use the whole text as draft
  return {
    draft: text,
    knowledgeGaps: [],
    decisions: [],
  };
}
