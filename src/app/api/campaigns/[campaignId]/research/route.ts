import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { KNOWLEDGE_AREAS, areasForPrompt } from "@/lib/knowledge-areas";
import type { BriefAssessment } from "@/lib/types";
import { RESEARCH_AGENT_SEEDS } from "@/lib/research-agent-seeds";
import { BRIEFING_FRAMEWORK } from "@/lib/briefing-questions";

const FINDINGS_FORMAT = `Return your findings as JSON with this exact structure:
{
  "findings": [
    {
      "area": "knowledge_area_id",
      "title": "Concise title of the finding",
      "content": "Detailed finding with key facts, data points, and insights.",
      "sources": ["https://example.com/article-you-found"]
    }
  ]
}

IMPORTANT: The "sources" array MUST contain the actual URLs you found the information from. Every finding should have at least one source URL. If you used multiple sources for a finding, include all of them.

Knowledge areas you can categorize into:
${areasForPrompt()}

Be thorough but concise. Focus on actionable, specific information rather than generic overviews.
Each finding should be self-contained and useful for campaign planning.`;

/**
 * POST /api/campaigns/[campaignId]/research
 *
 * Runs dedicated research agents (one per assessment category) to fill
 * knowledge gaps. Each agent uses its own instructions from the admin config.
 * Falls back to a single generic agent if no research agents are configured.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  await req.json().catch(() => ({}));

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      knowledgeEntries: { orderBy: [{ area: "asc" }, { createdAt: "asc" }] },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Load assessment
  let assessment: BriefAssessment | null = null;
  if (campaign.briefAssessment) {
    try {
      assessment =
        typeof campaign.briefAssessment === "string"
          ? JSON.parse(campaign.briefAssessment)
          : campaign.briefAssessment;
    } catch {
      /* ignore */
    }
  }

  // Load briefing categories with their questions and research agents
  let categories = await prisma.briefingCategory.findMany({
    where: { enabled: true },
    include: {
      questions: { where: { enabled: true } },
      researchAgent: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  // Auto-seed research agents if none exist
  const hasAnyAgent = categories.some((c) => c.researchAgent);
  if (!hasAnyAgent && categories.length > 0) {
    for (const cat of categories) {
      const seed = RESEARCH_AGENT_SEEDS.find((s) => {
        const frameworkCat = BRIEFING_FRAMEWORK.find((f) => f.label === cat.label);
        return frameworkCat && s.categoryKey === frameworkCat.id;
      });
      await prisma.researchAgentDef.create({
        data: {
          categoryId: cat.id,
          name: seed?.name ?? `${cat.label} Researcher`,
          instructions:
            seed?.instructions ??
            `Research specialist for: ${cat.label}.\n\nSearch for current, relevant information about this area and provide structured findings.`,
          allowedTools: JSON.stringify(["WebSearch", "WebFetch"]),
          maxTurns: 10,
        },
      });
    }
    // Reload with agents
    categories = await prisma.briefingCategory.findMany({
      where: { enabled: true },
      include: {
        questions: { where: { enabled: true } },
        researchAgent: true,
      },
      orderBy: { sortOrder: "asc" },
    });
  }

  // Build per-category research tasks
  interface ResearchTask {
    categoryId: string;
    categoryLabel: string;
    agentInstructions: string;
    agentAllowedTools: string[];
    agentMaxTurns: number;
    topics: string[];
  }

  const tasks: ResearchTask[] = [];

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const agent = cat.researchAgent;
    if (!agent || !agent.enabled) continue;

    const catTopics: string[] = [];

    // Find assessment gaps for this category
    // Match by index (order), or by DB id, or by AI-generated slug — the AI
    // sometimes returns slugs instead of the real DB cuid.
    if (assessment) {
      const assessCat =
        assessment.categories.find((ac) => ac.categoryId === cat.id) ??
        assessment.categories[i];

      if (assessCat) {
        for (const q of assessCat.questions) {
          if (q.status === "gap" || q.status === "partial") {
            // Match question by ID, or fall back to index within category
            const qDef = cat.questions.find((cq) => cq.id === q.questionId);
            const questionText = qDef?.question ?? `Question ${q.questionId}`;
            catTopics.push(
              `[${q.status.toUpperCase()}] ${questionText}\nCurrent evidence: ${q.evidence}`
            );
          }
        }
      }
    }

    // If no gaps for this category, skip it
    if (catTopics.length === 0) continue;

    tasks.push({
      categoryId: cat.id,
      categoryLabel: cat.label,
      agentInstructions: agent.instructions,
      agentAllowedTools: JSON.parse(agent.allowedTools) as string[],
      agentMaxTurns: agent.maxTurns,
      topics: catTopics,
    });
  }

  if (tasks.length === 0) {
    return NextResponse.json({
      message: "No gaps to research across assessment areas.",
      entriesCreated: 0,
      agentsRun: 0,
    });
  }

  // Existing context summary
  const contextSummary = campaign.knowledgeEntries
    .slice(0, 30)
    .map((e) => `- [${e.area}] ${e.title}`)
    .join("\n");

  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  // Run all category research agents in parallel
  const agentResults = await Promise.all(
    tasks.map(async (task): Promise<{
      category: string;
      findings: Array<{ area: string; title: string; content: string; sources: string[] }>;
      status: "ok" | "error";
    }> => {
      const systemPrompt = [
        task.agentInstructions,
        "",
        "---",
        "",
        FINDINGS_FORMAT,
      ].join("\n");

      const prompt = [
        `Research the following gaps for the campaign "${campaign.name}" in the area: ${task.categoryLabel}.`,
        campaign.description ? `Campaign context: ${campaign.description}` : "",
        "",
        "== EXISTING KNOWLEDGE (summary) ==",
        contextSummary || "(none yet)",
        "",
        `== RESEARCH TOPICS — ${task.categoryLabel} ==`,
        task.topics.map((t, i) => `${i + 1}. ${t}`).join("\n\n"),
        "",
        `Research each topic thoroughly. Return structured JSON findings.`,
      ]
        .filter(Boolean)
        .join("\n");

      try {
        let agentResult = "";
        for await (const message of query({
          prompt,
          options: {
            systemPrompt,
            allowedTools: task.agentAllowedTools,
            maxTurns: task.agentMaxTurns,
          },
        })) {
          if ("result" in message) {
            agentResult = message.result;
          }
        }

        const findings = parseFindings(agentResult).map((f) => {
          const validArea = KNOWLEDGE_AREAS.find((a) => a.id === f.area);
          return {
            area: validArea ? f.area : "other",
            title: f.title,
            content: f.content,
            sources: Array.isArray(f.sources) ? f.sources.filter((s: unknown) => typeof s === "string" && s.startsWith("http")) : [],
          };
        });

        return { category: task.categoryLabel, findings, status: "ok" as const };
      } catch (err) {
        console.error(`Research failed for ${task.categoryLabel}:`, err);
        return { category: task.categoryLabel, findings: [], status: "error" as const };
      }
    })
  );

  const agentsRun = agentResults.filter((r) => r.status === "ok").length;
  const totalFindings = agentResults.reduce((sum, r) => sum + r.findings.length, 0);

  return NextResponse.json({
    message: `Research complete. ${agentsRun} agents ran, ${totalFindings} findings ready for review.`,
    totalFindings,
    agentsRun,
    agentResults,
  });
}

function parseFindings(
  text: string
): Array<{ area: string; title: string; content: string; sources?: string[] }> {
  const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1]);
      if (parsed.findings && Array.isArray(parsed.findings))
        return parsed.findings;
    } catch {
      /* try next */
    }
  }

  const jsonMatch = text.match(/\{[\s\S]*"findings"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.findings && Array.isArray(parsed.findings))
        return parsed.findings;
    } catch {
      /* fallback */
    }
  }

  return [];
}
