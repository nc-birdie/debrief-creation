import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAreaLabel } from "@/lib/knowledge-areas";
import type { BriefAssessment } from "@/lib/types";

interface DbCategory {
  id: string;
  label: string;
  enabled: boolean;
  questions: Array<{ id: string; question: string; enabled: boolean }>;
}

async function loadBriefingTemplate(): Promise<DbCategory[]> {
  // Load from DB — the GET /api/admin/briefing-template auto-seeds if empty
  const categories = await prisma.briefingCategory.findMany({
    where: { enabled: true },
    include: {
      questions: {
        where: { enabled: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
  return categories;
}

function templateForPrompt(categories: DbCategory[]): string {
  return categories
    .map((cat) => {
      const qs = cat.questions
        .map((q) => `  - [${q.id}] ${q.question}`)
        .join("\n");
      return `### ${cat.label}\n${qs}`;
    })
    .join("\n\n");
}

const ASSESSMENT_SYSTEM_PROMPT = `You are a B2B marketing strategist assessing briefing readiness for a campaign.

You will receive:
1. A program context (structured knowledge entries organized by area)
2. A list of briefing questions grouped by category

Your task: For EACH briefing question, determine whether the program context provides sufficient information to answer it.

For each question, assign one of these statuses:
- "covered": The program context contains clear, specific information that answers this question
- "partial": The program context has some relevant information but it's incomplete, vague, or needs more detail
- "gap": The program context has no meaningful information to answer this question

Be strict: vague or generic information counts as "partial", not "covered". A question is only "covered" if someone could write a confident, specific answer based solely on the program context.

Return JSON with this exact structure:
{
  "categories": [
    {
      "categoryId": "objectives_kpis",
      "questions": [
        {
          "questionId": "obj-1",
          "status": "covered|partial|gap",
          "evidence": "Brief explanation of what we know (if covered/partial) or what's missing (if gap)",
          "entryIds": []
        }
      ]
    }
  ],
  "overallScore": 42,
  "summary": "2-3 sentence summary of overall readiness, highlighting critical gaps"
}

The overallScore is a percentage (0-100) of questions that are "covered".
Include EVERY question from EVERY category — do not skip any.`;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;

  // Load program context
  const knowledgeEntries = await prisma.knowledgeEntry.findMany({
    where: { campaignId },
    orderBy: [{ area: "asc" }, { createdAt: "asc" }],
  });

  if (knowledgeEntries.length === 0) {
    return NextResponse.json(
      { error: "No knowledge entries to assess. Ingest sources first." },
      { status: 400 }
    );
  }

  // Build program context for prompt
  const entriesByArea = new Map<
    string,
    Array<{ id: string; title: string; content: string }>
  >();
  for (const entry of knowledgeEntries) {
    const list = entriesByArea.get(entry.area) ?? [];
    list.push({ id: entry.id, title: entry.title, content: entry.content });
    entriesByArea.set(entry.area, list);
  }

  const programContextText = Array.from(entriesByArea.entries())
    .map(([area, entries]) => {
      const items = entries
        .map((e) => `- [${e.id}] **${e.title}**: ${e.content}`)
        .join("\n");
      return `### ${getAreaLabel(area)}\n${items}`;
    })
    .join("\n\n");

  // Load briefing template from DB
  const template = await loadBriefingTemplate();

  if (template.length === 0) {
    return NextResponse.json(
      { error: "No briefing template configured. Set up the template in Admin first." },
      { status: 400 }
    );
  }

  const prompt = [
    `Assess the briefing readiness of this campaign based on the following program context and briefing questions.`,
    ``,
    `== PROGRAM CONTEXT ==`,
    programContextText,
    ``,
    `== BRIEFING QUESTIONS ==`,
    templateForPrompt(template),
    ``,
    `Assess each question and return the JSON result.`,
  ].join("\n");

  let assessment: BriefAssessment;

  try {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");

    let agentResult = "";
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: ASSESSMENT_SYSTEM_PROMPT,
        maxTurns: 1,
      },
    })) {
      if ("result" in message) {
        agentResult = message.result;
      }
    }

    assessment = parseAssessment(agentResult);
  } catch {
    // Fallback: generate a basic gap-heavy assessment
    assessment = generateFallbackAssessment(template, knowledgeEntries);
  }

  assessment.assessedAt = new Date().toISOString();

  // Save to campaign
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { briefAssessment: JSON.stringify(assessment) },
  });

  return NextResponse.json(assessment);
}

// GET the existing assessment
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { briefAssessment: true },
  });

  if (!campaign?.briefAssessment) {
    return NextResponse.json(null);
  }

  return NextResponse.json(JSON.parse(campaign.briefAssessment));
}

function parseAssessment(text: string): BriefAssessment {
  const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {
      /* try next */
    }
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      /* fallback */
    }
  }
  return generateFallbackAssessment([], []);
}

function generateFallbackAssessment(
  template: DbCategory[],
  entries: Array<{ area: string }>
): BriefAssessment {
  const hasEntries = entries.length > 0;

  const categories = template.map((cat) => ({
    categoryId: cat.id,
    questions: cat.questions.map((q) => ({
      questionId: q.id,
      status: (hasEntries ? "partial" : "gap") as "covered" | "partial" | "gap",
      evidence: hasEntries
        ? "[AI assessment unavailable] Some knowledge exists but could not be mapped automatically"
        : "[AI assessment unavailable] No knowledge entries found",
      entryIds: [],
    })),
  }));

  return {
    categories,
    overallScore: 0,
    summary:
      "[AI assessment unavailable — install Claude CLI for full assessment] Basic heuristic assessment.",
    assessedAt: new Date().toISOString(),
  };
}
