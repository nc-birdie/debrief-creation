import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isReadableAsText, isBinaryFile } from "@/lib/file-types";
import type { SourceFileType } from "@/lib/file-types";
import { areasForPrompt } from "@/lib/knowledge-areas";
import fs from "node:fs";
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
    // .doc (legacy binary) — mammoth only supports .docx
    // Try reading as text, often contains some readable strings
    try {
      const buf = fs.readFileSync(filePath);
      // Extract printable ASCII runs from binary
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
  if (ext.endsWith(".xlsx") || ext.endsWith(".xls")) {
    // For spreadsheets, we'd need a library like xlsx
    // For now, tell the agent to use Read tool
    return null;
  }
  if (ext.endsWith(".pptx") || ext.endsWith(".ppt")) {
    // For presentations, we'd need a parser
    return null;
  }
  return null;
}

const EXTRACTION_SYSTEM_PROMPT = `You are a B2B marketing analyst extracting structured knowledge from source documents.

Your job is to extract EVERY discrete insight, fact, data point, claim, argument, or piece of context from the document. Do NOT summarize or compress — capture each piece of knowledge as its own entry. Be thorough: it is better to extract too many entries than to miss something that could be relevant later.

Each entry should be self-contained — someone reading just that entry should understand the insight without needing the original document.

Categorize each entry into one of these knowledge areas:
${areasForPrompt()}

Return JSON with this exact structure:
{
  "summary": "One-line description of what this document is about",
  "entries": [
    {
      "area": "product_technology",
      "title": "Short label for this insight (5-10 words)",
      "content": "The full insight with all relevant detail preserved. Include specific numbers, names, dates, and context."
    }
  ]
}

Rules:
- Extract 10-50+ entries per document depending on density
- Preserve specific numbers, percentages, dates, names, and quotes
- Each entry gets exactly one area — pick the best fit
- The title should be scannable — a reader should get the gist from the title alone
- The content should be comprehensive — do not truncate or paraphrase away detail
- If a fact could fit multiple areas, categorize by its primary relevance
- Use "other" only when no other area fits`;

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

  const results: Array<{
    id: string;
    name: string;
    status: string;
    entriesCreated?: number;
    error?: string;
  }> = [];

  for (const source of sources) {
    try {
      if (!fs.existsSync(source.filePath)) {
        results.push({
          id: source.id,
          name: source.name,
          status: "failed",
          error: "File not found",
        });
        continue;
      }

      const fileType = source.fileType as SourceFileType;
      let extracted: {
        summary: string;
        entries: Array<{ area: string; title: string; content: string }>;
      };

      try {
        const { query } = await import("@anthropic-ai/claude-agent-sdk");

        let prompt: string;
        let allowedTools: string[];

        // For document types (docx, doc, etc.), try server-side text extraction first
        if (fileType === "document") {
          const docText = await extractDocumentText(source.filePath, fileType);
          if (docText && docText.length > 50) {
            const truncated =
              docText.length > 30000
                ? docText.slice(0, 30000) + "\n\n[...truncated at 30k chars]"
                : docText;
            prompt = [
              `Extract all knowledge entries from this document:`,
              ``,
              `File: ${source.name} (${fileType})`,
              `---`,
              truncated,
            ].join("\n");
            allowedTools = [];
          } else {
            // Extraction failed — fall back to agent Read tool
            prompt = [
              `Read the file at: ${source.filePath}`,
              `File type: ${fileType}, File name: ${source.name}`,
              `Use the Read tool to access the file content, then extract ALL knowledge entries.`,
            ].join("\n");
            allowedTools = ["Read", "Glob", "Grep"];
          }
        } else if (isBinaryFile(fileType)) {
          prompt = [
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
          allowedTools = ["Read", "Glob", "Grep"];
        } else {
          const content = fs.readFileSync(source.filePath, "utf-8");
          const truncated =
            content.length > 30000
              ? content.slice(0, 30000) + "\n\n[...truncated at 30k chars]"
              : content;

          prompt = [
            `Extract all knowledge entries from this document:`,
            ``,
            `File: ${source.name} (${fileType})`,
            `---`,
            truncated,
          ].join("\n");
          allowedTools = [];
        }

        let agentResult = "";
        for await (const message of query({
          prompt,
          options: {
            systemPrompt: EXTRACTION_SYSTEM_PROMPT,
            allowedTools,
            maxTurns: allowedTools.length > 0 ? 5 : 1,
          },
        })) {
          if ("result" in message) {
            agentResult = message.result;
          }
        }

        extracted = parseExtractionResult(agentResult, source.name);
      } catch {
        // Fallback: create entries from raw text (with docx support)
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

      results.push({
        id: source.id,
        name: source.name,
        status: "ingested",
        entriesCreated: extracted.entries.length,
      });
    } catch (err) {
      console.error(`Ingest failed for ${source.name}:`, err);
      results.push({
        id: source.id,
        name: source.name,
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
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
  // Try markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1]);
      if (parsed.entries && Array.isArray(parsed.entries)) {
        return {
          summary: parsed.summary || sourceName,
          entries: parsed.entries.filter(
            (e: Record<string, unknown>) =>
              e.area && e.title && e.content
          ),
        };
      }
    } catch {
      /* try next */
    }
  }

  // Try raw JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.entries && Array.isArray(parsed.entries)) {
        return {
          summary: parsed.summary || sourceName,
          entries: parsed.entries.filter(
            (e: Record<string, unknown>) =>
              e.area && e.title && e.content
          ),
        };
      }
    } catch {
      /* fallback */
    }
  }

  // Couldn't parse JSON — treat the whole text as a single "other" entry
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

  // Try document text extraction for office files
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

  // Split text content into paragraph-based entries
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
