import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { KNOWLEDGE_AREAS, getAreaLabel } from "@/lib/knowledge-areas";
import { spawn } from "node:child_process";

/**
 * POST /api/campaigns/[campaignId]/research/plan
 *
 * Analyzes current context + artefact type and returns a research plan:
 * what must be covered, what gaps exist, and a prioritised outline.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const body = await req.json().catch(() => ({}));
  const artefactTypeId: string = body.artefactType ?? "";
  const artefactLabel: string = body.artefactLabel ?? "";
  const artefactDescription: string = body.artefactDescription ?? "";

  // Load artefact type instructions from DB
  let typeInstructions = "";
  if (artefactTypeId) {
    const typeDef = await prisma.artefactTypeDef.findFirst({
      where: { typeId: artefactTypeId },
    });
    if (typeDef) {
      typeInstructions = typeDef.instructions;
    }
  }

  // Load current knowledge
  const entries = await prisma.knowledgeEntry.findMany({
    where: { campaignId },
    orderBy: [{ area: "asc" }, { createdAt: "asc" }],
  });

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { name: true, description: true },
  });

  // Build context summary grouped by area
  const byArea = new Map<string, typeof entries>();
  for (const e of entries) {
    const list = byArea.get(e.area) ?? [];
    list.push(e);
    byArea.set(e.area, list);
  }

  const coveredAreas: string[] = [];
  const emptyAreas: string[] = [];
  const contextSummary: string[] = [];

  for (const area of KNOWLEDGE_AREAS) {
    const areaEntries = byArea.get(area.id);
    if (areaEntries && areaEntries.length > 0) {
      coveredAreas.push(area.label);
      contextSummary.push(
        `### ${area.label} (${areaEntries.length} entries)\n${areaEntries.map((e) => `- ${e.title}`).join("\n")}`
      );
    } else {
      emptyAreas.push(area.label);
    }
  }

  const prompt = `You are a senior B2B research strategist creating a research plan for a "${artefactLabel}" report.

## Campaign
Name: ${campaign?.name ?? "Unknown"}
${campaign?.description ? `Description: ${campaign.description}` : ""}

## Report type
${artefactLabel}: ${artefactDescription}
${typeInstructions ? `\nThe report should follow these guidelines:\n${typeInstructions}` : ""}

## Current knowledge base
Coverage: ${coveredAreas.length}/${KNOWLEDGE_AREAS.length} areas have entries.
${emptyAreas.length > 0 ? `Empty areas: ${emptyAreas.join(", ")}` : "All areas have some coverage."}

${contextSummary.join("\n\n")}

## Your task
Analyze the current knowledge base against what a comprehensive "${artefactLabel}" report needs. Produce a research plan with:

1. **Must-have sections** — areas that MUST be covered given the report type and current gaps. These are non-negotiable. For each, explain what's missing and why it matters.
2. **Should-have sections** — areas that would significantly strengthen the report but aren't critical. Explain the value.
3. **Nice-to-have sections** — areas where we already have decent coverage but could be enriched with external research.
4. **Executive summary** — 2-3 sentences summarising the overall research strategy.

Return ONLY a JSON object (no markdown fences):
{
  "summary": "2-3 sentence research strategy overview",
  "sections": [
    {
      "title": "Section title",
      "priority": "must-have" | "should-have" | "nice-to-have",
      "description": "What to research and why",
      "currentCoverage": "What we already know (or 'none')",
      "researchFocus": "Specific questions or angles to investigate"
    }
  ]
}

Rules:
- 5-10 sections total
- At least 2 must-haves
- Be specific about what to research, not generic
- Reference actual gaps in the current knowledge base
- The plan should be tailored to this specific report type, not generic research`;

  try {
    const result = await callCli(prompt);
    const plan = parsePlan(result);
    return NextResponse.json(plan);
  } catch (err) {
    console.error("[research-plan] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate research plan" },
      { status: 500 }
    );
  }
}

function callCli(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("claude", ["-p", "--output-format", "text"], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });
    let stdout = "";
    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr.on("data", () => {});
    child.on("close", () => resolve(stdout.trim()));
    child.on("error", () => resolve(""));
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

interface ResearchPlan {
  summary: string;
  sections: Array<{
    title: string;
    priority: "must-have" | "should-have" | "nice-to-have";
    description: string;
    currentCoverage: string;
    researchFocus: string;
  }>;
}

function parsePlan(raw: string): ResearchPlan {
  const fallback: ResearchPlan = {
    summary: "Could not generate a plan. The research will proceed with default coverage.",
    sections: [],
  };

  for (const attempt of [
    () => JSON.parse(raw.trim()),
    () => {
      const m = raw.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
      return m ? JSON.parse(m[1]) : null;
    },
    () => {
      const s = raw.indexOf("{");
      const e = raw.lastIndexOf("}");
      return s !== -1 && e > s ? JSON.parse(raw.slice(s, e + 1)) : null;
    },
  ]) {
    try {
      const parsed = attempt();
      if (parsed?.sections && Array.isArray(parsed.sections)) return parsed;
    } catch {
      /* next */
    }
  }

  return fallback;
}
