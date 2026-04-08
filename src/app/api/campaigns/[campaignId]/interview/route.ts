import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { KNOWLEDGE_AREAS } from "@/lib/knowledge-areas";
import { getAgentConfig } from "@/lib/agent-config";
import { spawn } from "node:child_process";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function buildContextBlock(
  entries: Array<{ area: string; title: string; content: string }>
): string {
  if (entries.length === 0) {
    return "No knowledge entries exist yet. The campaign context is completely empty — start from scratch by understanding the basics: what the product/service is, who the target audience is, and what the campaign aims to achieve.";
  }

  const byArea = new Map<string, typeof entries>();
  for (const e of entries) {
    const list = byArea.get(e.area) ?? [];
    list.push(e);
    byArea.set(e.area, list);
  }

  const sections: string[] = [];
  const coveredAreas: string[] = [];
  const emptyAreas: string[] = [];

  for (const area of KNOWLEDGE_AREAS) {
    const areaEntries = byArea.get(area.id);
    if (areaEntries && areaEntries.length > 0) {
      coveredAreas.push(area.label);
      sections.push(
        `### ${area.label}\n${areaEntries.map((e) => `- **${e.title}**: ${e.content}`).join("\n")}`
      );
    } else {
      emptyAreas.push(area.label);
    }
  }

  const summary = [
    `Coverage: ${coveredAreas.length}/${KNOWLEDGE_AREAS.length} areas have entries.`,
    emptyAreas.length > 0
      ? `Empty areas (gaps): ${emptyAreas.join(", ")}`
      : "All areas have at least some coverage.",
    "",
    ...sections,
  ].join("\n");

  return summary;
}

function callCli(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("claude", ["-p", "--output-format", "text"], {
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code: number | null) => {
      if (code !== 0 || stdout.length === 0) {
        console.warn(
          `[interview] CLI exit code ${code}, stderr: ${stderr.slice(0, 300)}`
        );
      }
      resolve(stdout.trim());
    });

    child.on("error", (err: Error) => {
      console.warn(`[interview] CLI spawn error:`, err.message);
      resolve("");
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const body = await req.json();
  const action: string = body.action ?? "chat";
  const messages: ChatMessage[] = body.messages ?? [];
  const focusArea: string | undefined = body.focusArea;

  // Fetch current knowledge
  const entries = await prisma.knowledgeEntry.findMany({
    where: { campaignId },
    orderBy: [{ area: "asc" }, { createdAt: "asc" }],
  });

  const contextBlock = buildContextBlock(entries);

  // ── Suggest: return topic suggestions ──
  if (action === "suggest") {
    const suggestConfig = await getAgentConfig("interview_suggest");
    const prompt = [
      suggestConfig.instructions,
      "",
      "== CURRENT CAMPAIGN KNOWLEDGE BASE ==",
      contextBlock,
    ].join("\n");

    try {
      const raw = await callCli(prompt);
      const suggestions = parseSuggestions(raw);
      return NextResponse.json({ suggestions });
    } catch (err) {
      console.error("[interview] Suggest error:", err);
      return NextResponse.json(
        { error: "Failed to generate suggestions" },
        { status: 500 }
      );
    }
  }

  // ── Start / Chat: run the interview ──
  const interviewConfig = await getAgentConfig("interview");
  const parts: string[] = [
    interviewConfig.instructions,
    "",
    "== CURRENT CAMPAIGN KNOWLEDGE BASE ==",
    contextBlock,
    "",
    "== CONVERSATION ==",
  ];

  if (action === "start" || messages.length === 0) {
    if (focusArea) {
      parts.push(
        `The user has chosen to focus on: "${focusArea}"\n\nStart the interview with a warm, professional opening and ask your first question focused on this area. Be specific and make it easy for the user to answer.`
      );
    } else {
      parts.push(
        "The interview is just starting. Review the knowledge base above and ask your first question about the most important gap or area needing clarification. Be warm and professional in your opening."
      );
    }
  } else {
    for (const msg of messages) {
      const label = msg.role === "assistant" ? "Interviewer" : "User";
      parts.push(`${label}: ${msg.content}`);
    }
    parts.push(
      "",
      "Continue the interview. Respond to the user's latest answer and ask your next question. If you feel you've gathered enough, suggest wrapping up."
    );
  }

  const fullPrompt = parts.join("\n");

  try {
    const response = await callCli(fullPrompt);

    if (!response) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: response });
  } catch (err) {
    console.error("[interview] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interview failed" },
      { status: 500 }
    );
  }
}

function parseSuggestions(
  raw: string
): Array<{ label: string; description: string; focusPrompt: string }> {
  const fallback = [
    {
      label: "Product & value proposition",
      description:
        "Understand what you're selling and why it matters to buyers",
      focusPrompt:
        "Let's start with the basics — can you walk me through what your product or service does and the core value it delivers?",
    },
    {
      label: "Target audience & pain points",
      description:
        "Clarify who you're targeting and the problems they face",
      focusPrompt:
        "Who is the primary audience for this campaign, and what are the biggest challenges they're dealing with?",
    },
    {
      label: "Competitive landscape",
      description:
        "Map out how you're positioned against alternatives",
      focusPrompt:
        "How do you see the competitive landscape? Who are the main alternatives buyers consider?",
    },
  ];

  try {
    // Try direct parse
    const parsed = JSON.parse(raw.trim());
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].label) {
      return parsed;
    }
  } catch {
    /* continue */
  }

  // Try code fences
  const fenceMatch = raw.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1]);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].label) {
        return parsed;
      }
    } catch {
      /* continue */
    }
  }

  // Try bracket matching
  const bracketStart = raw.indexOf("[");
  const bracketEnd = raw.lastIndexOf("]");
  if (bracketStart !== -1 && bracketEnd > bracketStart) {
    try {
      const parsed = JSON.parse(raw.slice(bracketStart, bracketEnd + 1));
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].label) {
        return parsed;
      }
    } catch {
      /* continue */
    }
  }

  console.warn("[interview] Failed to parse suggestions, using fallback");
  return fallback;
}
