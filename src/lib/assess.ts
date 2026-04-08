import { prisma } from "@/lib/db";
import { getAreaLabel } from "@/lib/knowledge-areas";
import { getAgentConfig } from "@/lib/agent-config";
import type { BriefAssessment, CoverageStatus } from "@/lib/types";
import { spawn } from "node:child_process";

interface DbCategory {
  id: string;
  label: string;
  enabled: boolean;
  questions: Array<{ id: string; question: string; enabled: boolean }>;
}

export async function loadBriefingTemplate(): Promise<DbCategory[]> {
  let categories = await prisma.briefingCategory.findMany({
    where: { enabled: true },
    include: {
      questions: {
        where: { enabled: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  if (categories.length === 0) {
    const { BRIEFING_FRAMEWORK } = await import("@/lib/briefing-questions");
    for (let i = 0; i < BRIEFING_FRAMEWORK.length; i++) {
      const cat = BRIEFING_FRAMEWORK[i];
      await prisma.briefingCategory.create({
        data: {
          label: cat.label,
          sortOrder: i,
          questions: {
            create: cat.questions.map((q: { question: string }, j: number) => ({
              question: q.question,
              sortOrder: j,
            })),
          },
        },
      });
    }
    categories = await prisma.briefingCategory.findMany({
      where: { enabled: true },
      include: {
        questions: {
          where: { enabled: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });
  }

  return categories;
}

function templateForPrompt(categories: DbCategory[]): string {
  return categories
    .map((cat) => {
      const qs = cat.questions
        .map((q) => `  - [${q.id}] ${q.question}`)
        .join("\n");
      return `### [${cat.id}] ${cat.label}\n${qs}`;
    })
    .join("\n\n");
}

// Loaded from DB via getAgentConfig at runtime

function callCli(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("claude", ["-p", "--output-format", "text"], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });
    let stdout = "";
    child.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on("data", () => {});
    child.on("close", () => resolve(stdout.trim()));
    child.on("error", () => resolve(""));
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function groupByArea(
  entries: Array<{ area: string; id: string; title: string; content: string }>
): Map<string, Array<{ id: string; title: string; content: string }>> {
  const map = new Map<string, Array<{ id: string; title: string; content: string }>>();
  for (const entry of entries) {
    const list = map.get(entry.area) ?? [];
    list.push({ id: entry.id, title: entry.title, content: entry.content });
    map.set(entry.area, list);
  }
  return map;
}

/**
 * Run a full or delta assessment. If deltaEntryIds is provided, only assesses
 * the new entries against the existing assessment.
 */
export async function runAssessment(
  campaignId: string,
  deltaEntryIds: string[] | null
): Promise<BriefAssessment> {
  const knowledgeEntries = await prisma.knowledgeEntry.findMany({
    where: { campaignId },
    orderBy: [{ area: "asc" }, { createdAt: "asc" }],
  });

  const template = await loadBriefingTemplate();

  let existingAssessment: BriefAssessment | null = null;
  if (deltaEntryIds && deltaEntryIds.length > 0) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { briefAssessment: true },
    });
    if (campaign?.briefAssessment) {
      try {
        existingAssessment = JSON.parse(campaign.briefAssessment);
      } catch { /* run full */ }
    }
  }

  let assessment: BriefAssessment;

  if (existingAssessment && deltaEntryIds && deltaEntryIds.length > 0) {
    const newEntries = knowledgeEntries.filter((e) => deltaEntryIds.includes(e.id));
    const newEntriesText = Array.from(groupByArea(newEntries).entries())
      .map(([area, entries]) => {
        const items = entries.map((e) => `- **${e.title}**: ${e.content}`).join("\n");
        return `### ${getAreaLabel(area)}\n${items}`;
      })
      .join("\n\n");

    const deltaConfig = await getAgentConfig("assessment_delta");
    const prompt = [
      deltaConfig.instructions, "", "---", "",
      `== CURRENT ASSESSMENT ==`,
      JSON.stringify(existingAssessment, null, 2), "",
      `== NEW KNOWLEDGE ENTRIES (just added) ==`,
      newEntriesText, "",
      `== BRIEFING QUESTIONS ==`,
      templateForPrompt(template), "",
      `Update the assessment based on the new entries and return the full JSON.`,
    ].join("\n");

    console.log(`[assess] Running delta assessment with ${newEntries.length} new entries`);
    const result = await callCli(prompt);
    assessment = parseAssessment(result, template, knowledgeEntries);
  } else {
    const programContextText = Array.from(groupByArea(knowledgeEntries).entries())
      .map(([area, entries]) => {
        const items = entries.map((e) => `- [${e.id}] **${e.title}**: ${e.content}`).join("\n");
        return `### ${getAreaLabel(area)}\n${items}`;
      })
      .join("\n\n");

    const assessConfig = await getAgentConfig("assessment");
    const prompt = [
      assessConfig.instructions, "", "---", "",
      `Assess the briefing readiness of this campaign.`, "",
      `== PROGRAM CONTEXT ==`,
      programContextText, "",
      `== BRIEFING QUESTIONS ==`,
      templateForPrompt(template), "",
      `Assess each question and return the JSON result.`,
    ].join("\n");

    console.log(`[assess] Running full assessment with ${knowledgeEntries.length} entries`);
    const result = await callCli(prompt);
    assessment = parseAssessment(result, template, knowledgeEntries);
  }

  assessment.assessedAt = new Date().toISOString();

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { briefAssessment: JSON.stringify(assessment) },
  });

  return assessment;
}

function parseAssessment(
  text: string,
  template: DbCategory[],
  entries: Array<{ area: string }>
): BriefAssessment {
  try {
    const parsed = JSON.parse(text.trim());
    if (parsed.categories) return parsed;
  } catch { /* try next */ }

  const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1]);
      if (parsed.categories) return parsed;
    } catch { /* try next */ }
  }

  const jsonMatch = extractOutermostJson(text);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch);
      if (parsed.categories) return parsed;
    } catch { /* fallback */ }
  }

  console.warn(`[assess] JSON parse failed. First 300 chars:`, text.slice(0, 300));
  return generateFallbackAssessment(template, entries);
}

function extractOutermostJson(text: string): string | null {
  let start = -1, depth = 0, inString = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") { if (depth === 0) start = i; depth++; }
    else if (ch === "}") { depth--; if (depth === 0 && start !== -1) return text.slice(start, i + 1); }
  }
  return null;
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
      status: (hasEntries ? "partial" : "gap") as CoverageStatus,
      evidence: hasEntries
        ? "[Auto-assessment pending]"
        : "[No knowledge entries found]",
      entryIds: [],
    })),
  }));
  return {
    categories,
    overallScore: 0,
    summary: "Assessment could not be completed automatically.",
    assessedAt: new Date().toISOString(),
  };
}
