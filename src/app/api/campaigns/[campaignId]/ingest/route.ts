import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isReadableAsText, isBinaryFile } from "@/lib/file-types";
import type { SourceFileType } from "@/lib/file-types";
import { getAgentConfig } from "@/lib/agent-config";
import { runAssessment } from "@/lib/assess";
import fs from "node:fs";
import { spawn } from "node:child_process";
import mammoth from "mammoth";
// Extract text from office documents
async function extractDocumentText(
  filePath: string,
  fileType: SourceFileType
): Promise<string | null> {
  const ext = filePath.toLowerCase();
  if (ext.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }
  if (ext.endsWith(".doc")) {
    try {
      const buf = fs.readFileSync(filePath);
      const text = buf
        .toString("utf-8")
        .replace(/[^\x20-\x7E\n\r\t]/g, " ")
        .replace(/ {3,}/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      return text.length > 50 ? text : null;
    } catch {
      return null;
    }
  }
  return null;
}

// Loaded from DB at runtime via getAgentConfig("ingest")
let _cachedIngestPrompt: string | null = null;
async function getIngestSystemPrompt(): Promise<string> {
  if (!_cachedIngestPrompt) {
    const config = await getAgentConfig("ingest");
    _cachedIngestPrompt = config.instructions;
  }
  return _cachedIngestPrompt;
}

/**
 * Run extraction via Claude CLI (`claude -p`).
 * For text files, passes the prompt directly.
 * For binary files, uses the agent SDK with Read tools.
 */
async function extractViaAgent(
  prompt: string,
  allowedTools: string[]
): Promise<string> {
  // For text content (no tools needed), use claude -p directly — more reliable
  if (allowedTools.length === 0) {
    return extractViaCli(prompt);
  }

  // For binary files that need tools, use agent SDK
  return extractViaAgentSdk(prompt, allowedTools);
}

async function extractViaCli(prompt: string): Promise<string> {
  const systemPrompt = await getIngestSystemPrompt();
  return new Promise((resolve) => {
    console.log(`[ingest] Starting CLI extraction (${prompt.length} char prompt)`);

    const fullPrompt = `${systemPrompt}\n\n---\n\n${prompt}`;
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
        console.warn(`[ingest] CLI exit code ${code}, stderr: ${stderr.slice(0, 300)}`);
      }
      console.log(`[ingest] CLI returned ${stdout.length} chars. First 300:`, stdout.slice(0, 300));
      resolve(stdout.trim());
    });

    child.on("error", (err: Error) => {
      console.warn(`[ingest] CLI spawn error:`, err.message);
      resolve("");
    });

    child.stdin.write(fullPrompt);
    child.stdin.end();
  });
}

async function extractViaAgentSdk(
  prompt: string,
  allowedTools: string[]
): Promise<string> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  console.log(`[ingest] Starting agent SDK extraction (tools: ${allowedTools.join(",")}, maxTurns: 5)`);
  let agentResult = "";
  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt: await getIngestSystemPrompt(),
        allowedTools,
        maxTurns: 5,
      },
    })) {
      if ("result" in message) {
        agentResult = message.result;
      }
    }
  } catch (err) {
    console.warn(`[ingest] Agent SDK error:`, err);
  }
  console.log(`[ingest] Agent SDK returned ${agentResult.length} chars`);
  return agentResult;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const { searchParams } = new URL(req.url);
  const sourceId = searchParams.get("sourceId");

  const sources = await prisma.source.findMany({
    where: {
      campaignId,
      ingested: false,
      ...(sourceId ? { id: sourceId } : {}),
    },
  });

  if (sources.length === 0) {
    return NextResponse.json({ message: "No sources to ingest" });
  }

  // Ingest all sources in parallel
  const results = await Promise.all(
    sources.map(async (source): Promise<{
      id: string;
      name: string;
      status: string;
      entriesCreated?: number;
      error?: string;
    }> => {
      try {
        if (!fs.existsSync(source.filePath)) {
          return { id: source.id, name: source.name, status: "failed", error: "File not found" };
        }

        const fileType = source.fileType as SourceFileType;
        let extracted: {
          summary: string;
          entries: Array<{ area: string; title: string; content: string }>;
        };

        try {
          // Determine if we can use the fast API path or need agent tools
          let textContent: string | null = null;

          if (fileType === "document") {
            textContent = await extractDocumentText(source.filePath, fileType);
          } else if (isReadableAsText(fileType)) {
            textContent = fs.readFileSync(source.filePath, "utf-8");
          }

          if (textContent && textContent.length > 50) {
            // Text is in memory — no tools needed, single-turn agent call
            const truncated =
              textContent.length > 30000
                ? textContent.slice(0, 30000) + "\n\n[...truncated at 30k chars]"
                : textContent;

            const prompt = [
              `Extract all knowledge entries from this document:`,
              ``,
              `File: ${source.name} (${fileType})`,
              `---`,
              truncated,
            ].join("\n");

            const result = await extractViaAgent(prompt, []);
            if (result.length > 0) {
              extracted = parseExtractionResult(result, source.name);
            } else {
              // Agent returned nothing — use text splitting as fallback
              console.warn(`[ingest] Agent returned empty for ${source.name}, using text split fallback`);
              extracted = splitTextIntoEntries(truncated, source.name);
            }
          } else if (isBinaryFile(fileType)) {
            // Slow path: need agent with Read tool for PDFs, images, notebooks
            const prompt = [
              `Read the file at: ${source.filePath}`,
              ``,
              `File type: ${fileType}, File name: ${source.name}`,
              ``,
              `Use the Read tool to access the file content.`,
              fileType === "pdf"
                ? `This is a PDF — Read will render its text content. If it's large, read the first 10-15 pages.`
                : "",
              fileType === "image"
                ? `This is an image — Read will show you the visual content. Extract any text, data, diagrams, or strategic information you can see.`
                : "",
              fileType === "notebook"
                ? `This is a Jupyter notebook — Read will show cells with code, text, and outputs.`
                : "",
              ``,
              `Then extract ALL knowledge entries from the content as described in your instructions.`,
            ]
              .filter(Boolean)
              .join("\n");

            const result = await extractViaAgent(prompt, ["Read", "Glob", "Grep"]);
            if (result.length > 0) {
              extracted = parseExtractionResult(result, source.name);
            } else {
              console.warn(`[ingest] Agent returned empty for binary ${source.name}, using fallback`);
              extracted = await fallbackExtraction(source);
            }
          } else {
            // Fallback for edge cases
            extracted = await fallbackExtraction(source);
          }
        } catch {
          extracted = await fallbackExtraction(source);
        }

        // Save summary on source
        await prisma.source.update({
          where: { id: source.id },
          data: { summary: extracted.summary, ingested: true },
        });

        // Create knowledge entries
        if (extracted.entries.length > 0) {
          await prisma.knowledgeEntry.createMany({
            data: extracted.entries.map((e) => ({
              campaignId,
              sourceId: source.id,
              area: e.area,
              title: e.title,
              content: e.content,
            })),
          });
        }

        return {
          id: source.id,
          name: source.name,
          status: "ingested",
          entriesCreated: extracted.entries.length,
        };
      } catch (err) {
        console.error(`Ingest failed for ${source.name}:`, err);
        return {
          id: source.id,
          name: source.name,
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    })
  );

  // Collect IDs of all newly created entries for delta assessment
  const newEntryIds: string[] = [];
  const successfulIngests = results.filter((r) => r.status === "ingested" && (r.entriesCreated ?? 0) > 0);
  if (successfulIngests.length > 0) {
    // Fetch the entry IDs we just created (entries linked to the ingested sources)
    const sourceIds = successfulIngests.map((r) => r.id);
    const newEntries = await prisma.knowledgeEntry.findMany({
      where: { campaignId, sourceId: { in: sourceIds } },
      select: { id: true },
    });
    newEntryIds.push(...newEntries.map((e) => e.id));
  }

  // Auto-trigger brief assessment in the background
  if (newEntryIds.length > 0) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { briefAssessment: true },
    });
    const hasPriorAssessment = !!campaign?.briefAssessment;

    // Run assessment in background — don't block the response
    runAssessment(campaignId, hasPriorAssessment ? newEntryIds : null).catch(
      (err) => console.warn("[ingest] Auto-assessment failed:", err)
    );

    console.log(
      `[ingest] Auto-triggered ${hasPriorAssessment ? "delta" : "full"} assessment with ${newEntryIds.length} new entries`
    );
  }

  return NextResponse.json({ results });
}

function parseExtractionResult(
  text: string,
  sourceName: string
): {
  summary: string;
  entries: Array<{ area: string; title: string; content: string }>;
} {
  // Helper: validate and return parsed result if it has entries
  function tryParse(
    json: string
  ): { summary: string; entries: Array<{ area: string; title: string; content: string }> } | null {
    try {
      const parsed = JSON.parse(json);
      if (parsed.entries && Array.isArray(parsed.entries)) {
        const entries = parsed.entries.filter(
          (e: Record<string, unknown>) => e.area && e.title && e.content
        );
        if (entries.length > 0) {
          return { summary: parsed.summary || sourceName, entries };
        }
      }
    } catch {
      /* not valid */
    }
    return null;
  }

  // 1. Try the whole text as JSON (agent returned pure JSON)
  const direct = tryParse(text.trim());
  if (direct) return direct;

  // 2. Try code fences (greedy — get the largest fenced block)
  const fenceMatches = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n```/g)];
  for (const match of fenceMatches) {
    const result = tryParse(match[1]);
    if (result) return result;
  }

  // 3. Find the outermost JSON object using brace matching
  const braceResult = extractOutermostJson(text);
  if (braceResult) {
    const result = tryParse(braceResult);
    if (result) return result;
  }

  // 4. Last resort: try to find any JSON array of entries
  const arrayMatch = text.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (arrayMatch) {
    const result = tryParse(`{"summary":"${sourceName}","entries":${arrayMatch[0]}}`);
    if (result) return result;
  }

  // 5. Fallback: dump the text as a single entry so nothing is lost,
  //    but log a warning so we can debug
  console.warn(
    `[ingest] JSON extraction failed for ${sourceName}, falling back to raw text (${text.length} chars). First 200 chars:`,
    text.slice(0, 200)
  );
  return {
    summary: sourceName,
    entries: [
      {
        area: "other",
        title: `Extracted content from ${sourceName}`,
        content: text,
      },
    ],
  };
}

/** Walk the string to find the outermost balanced { ... } */
function extractOutermostJson(text: string): string | null {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

async function fallbackExtraction(source: {
  name: string;
  filePath: string;
  fileType: string;
  sizeBytes: number;
}): Promise<{
  summary: string;
  entries: Array<{ area: string; title: string; content: string }>;
}> {
  const ft = source.fileType as SourceFileType;

  if (ft === "document") {
    const docText = await extractDocumentText(source.filePath, ft);
    if (docText && docText.length > 50) {
      return splitTextIntoEntries(docText, source.name);
    }
  }

  if (!isReadableAsText(ft)) {
    return {
      summary: `${source.fileType} file: ${source.name}`,
      entries: [
        {
          area: "other",
          title: source.name,
          content: `[Could not extract — ${source.fileType} file, ${formatBytes(source.sizeBytes)}. AI extraction unavailable.]`,
        },
      ],
    };
  }

  const content = fs.readFileSync(source.filePath, "utf-8");
  return splitTextIntoEntries(content, source.name);
}

function splitTextIntoEntries(
  content: string,
  sourceName: string
): {
  summary: string;
  entries: Array<{ area: string; title: string; content: string }>;
} {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 30);

  if (paragraphs.length === 0) {
    return {
      summary: sourceName,
      entries: [
        {
          area: "other",
          title: sourceName,
          content: content.slice(0, 2000),
        },
      ],
    };
  }

  const entries: Array<{ area: string; title: string; content: string }> = [];
  for (let i = 0; i < paragraphs.length; i += 3) {
    const chunk = paragraphs.slice(i, i + 3).join("\n\n");
    entries.push({
      area: "other",
      title: `${sourceName} — section ${Math.floor(i / 3) + 1}`,
      content: chunk,
    });
  }

  return {
    summary: `[No AI] ${sourceName} — ${entries.length} sections extracted`,
    entries,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
