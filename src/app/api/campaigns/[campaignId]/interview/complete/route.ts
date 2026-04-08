import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { getAgentConfig } from "@/lib/agent-config";
import { runAssessment } from "@/lib/assess";
import { spawn } from "node:child_process";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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
          `[interview-complete] CLI exit code ${code}, stderr: ${stderr.slice(0, 300)}`
        );
      }
      resolve(stdout.trim());
    });

    child.on("error", (err: Error) => {
      console.warn(`[interview-complete] CLI spawn error:`, err.message);
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
  const messages: ChatMessage[] = body.messages ?? [];

  if (messages.length < 2) {
    return NextResponse.json(
      { error: "Not enough conversation to extract from" },
      { status: 400 }
    );
  }

  // Get current user for the source name
  const user = await getCurrentUser();
  const sourceName = `${user.displayName || user.username} chat interview`;

  // Format conversation for extraction
  const conversationText = messages
    .map((m) => {
      const label = m.role === "assistant" ? "Interviewer" : "User";
      return `${label}: ${m.content}`;
    })
    .join("\n\n");

  const extractConfig = await getAgentConfig("interview_extract");
  const fullPrompt = [
    extractConfig.instructions,
    "",
    "== INTERVIEW TRANSCRIPT ==",
    conversationText,
  ].join("\n");

  try {
    const result = await callCli(fullPrompt);

    if (!result) {
      return NextResponse.json(
        { error: "Failed to extract knowledge from interview" },
        { status: 500 }
      );
    }

    // Parse the extraction result
    const parsed = parseResult(result);

    if (parsed.entries.length === 0) {
      return NextResponse.json({
        message: "No extractable knowledge found in the conversation",
        entriesCreated: 0,
      });
    }

    // Create a Source record for this interview
    const source = await prisma.source.create({
      data: {
        campaignId,
        name: sourceName,
        filePath: `interview:${new Date().toISOString()}`,
        fileType: "notes",
        sizeBytes: conversationText.length,
        summary: `Chat interview with ${parsed.entries.length} insights extracted across ${new Set(parsed.entries.map((e) => e.area)).size} areas`,
        ingested: true,
      },
    });

    // Create knowledge entries
    await prisma.knowledgeEntry.createMany({
      data: parsed.entries.map((e) => ({
        campaignId,
        sourceId: source.id,
        area: e.area,
        title: e.title,
        content: e.content,
      })),
    });

    // Trigger assessment update in background
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { briefAssessment: true },
    });

    const newEntries = await prisma.knowledgeEntry.findMany({
      where: { campaignId, sourceId: source.id },
      select: { id: true },
    });

    const hasPrior = !!campaign?.briefAssessment;
    runAssessment(
      campaignId,
      hasPrior ? newEntries.map((e) => e.id) : null
    ).catch((err) =>
      console.warn("[interview-complete] Auto-assessment failed:", err)
    );

    return NextResponse.json({
      message: "Interview knowledge registered successfully",
      entriesCreated: parsed.entries.length,
      sourceId: source.id,
      sourceName,
    });
  } catch (err) {
    console.error("[interview-complete] Error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to complete interview",
      },
      { status: 500 }
    );
  }
}

function parseResult(text: string): {
  entries: Array<{ area: string; title: string; content: string }>;
} {
  // Try direct parse
  try {
    const parsed = JSON.parse(text.trim());
    if (parsed.entries && Array.isArray(parsed.entries)) {
      return {
        entries: parsed.entries.filter(
          (e: Record<string, unknown>) => e.area && e.title && e.content
        ),
      };
    }
  } catch {
    /* continue */
  }

  // Try code fences
  const fenceMatches = [
    ...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n```/g),
  ];
  for (const match of fenceMatches) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.entries && Array.isArray(parsed.entries)) {
        return {
          entries: parsed.entries.filter(
            (e: Record<string, unknown>) => e.area && e.title && e.content
          ),
        };
      }
    } catch {
      /* continue */
    }
  }

  // Try brace matching
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      const parsed = JSON.parse(text.slice(braceStart, braceEnd + 1));
      if (parsed.entries && Array.isArray(parsed.entries)) {
        return {
          entries: parsed.entries.filter(
            (e: Record<string, unknown>) => e.area && e.title && e.content
          ),
        };
      }
    } catch {
      /* continue */
    }
  }

  console.warn(
    "[interview-complete] Failed to parse extraction result:",
    text.slice(0, 200)
  );
  return { entries: [] };
}
