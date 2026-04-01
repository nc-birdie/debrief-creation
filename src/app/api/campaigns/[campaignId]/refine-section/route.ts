import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAreaLabel } from "@/lib/knowledge-areas";

/**
 * POST /api/campaigns/[campaignId]/refine-section
 *
 * Handles three phases:
 *   "refine"       — Legacy: refine markdown section + analyze ripple
 *   "refine-block" — Refine an immersive design block + analyze ripple across all blocks
 *   "apply"        — Apply confirmed ripple changes to step outputs
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const body = await req.json();
  const phase = body.phase ?? "refine";

  if (phase === "apply") return handleApply(campaignId, body);
  if (phase === "refine-block") return handleRefineBlock(campaignId, body);
  return handleRefine(campaignId, body);
}

// ── Refine block (immersive design) ─────────────────────────────────

async function handleRefineBlock(
  campaignId: string,
  body: {
    blockIndex: number;
    block: Record<string, unknown>;
    userMessage: string;
    allBlocks: Record<string, unknown>[];
  }
) {
  const { blockIndex, block, userMessage, allBlocks } = body;

  if (!block || !userMessage) {
    return NextResponse.json(
      { error: "block and userMessage are required" },
      { status: 400 }
    );
  }

  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  // ── Step 1: Refine the target block ──

  const refinePrompt = [
    `You are editing a single block in an immersive campaign strategy document.`,
    ``,
    `Block type: ${block.type}`,
    `Current block JSON:`,
    JSON.stringify(block, null, 2),
    ``,
    `User feedback: ${userMessage}`,
    ``,
    `Return the updated block as a JSON object with the same "type" field and structure. Change only what the user asked for. Return ONLY valid JSON — no markdown fences, no explanation.`,
  ].join("\n");

  let updatedBlock = block;
  try {
    let result = "";
    for await (const message of query({
      prompt: refinePrompt,
      options: {
        systemPrompt:
          "You are a B2B marketing strategist and editorial designer. Update the given design block according to the user's feedback. Return only the JSON block object.",
        maxTurns: 1,
      },
    })) {
      if ("result" in message) result = message.result;
    }
    updatedBlock = parseJson(result) ?? block;
  } catch (err) {
    console.error("Block refinement failed:", err);
    return NextResponse.json({ error: "Refinement failed" }, { status: 500 });
  }

  // ── Step 2: Analyze ripple effects on other blocks ──

  const otherBlocks = allBlocks
    .map((b, i) => (i === blockIndex ? null : `[Block ${i}] ${JSON.stringify(b)}`))
    .filter(Boolean)
    .join("\n\n");

  const ripplePrompt = [
    `A block in an immersive campaign strategy document was just changed.`,
    ``,
    `Changed block (index ${blockIndex}):`,
    JSON.stringify(updatedBlock, null, 2),
    ``,
    `User feedback that triggered the change: ${userMessage}`,
    ``,
    `All other blocks in the document:`,
    otherBlocks,
    ``,
    `Analyze whether the change requires updates to any other blocks for consistency.`,
    ``,
    `Return JSON:`,
    `{`,
    `  "sectionChanges": [`,
    `    { "blockIndex": 3, "reason": "Why this block needs updating", "updatedBlock": { ...full updated block JSON... } }`,
    `  ],`,
    `  "summary": "One sentence summary, or 'No changes needed elsewhere.'"`,
    `}`,
    ``,
    `Only propose changes for genuine inconsistencies. Return empty sectionChanges if nothing needs changing.`,
    `Return ONLY valid JSON — no markdown fences.`,
  ].join("\n");

  let ripple = { sectionChanges: [] as unknown[], summary: "No changes needed elsewhere." };
  try {
    let rippleResult = "";
    for await (const message of query({
      prompt: ripplePrompt,
      options: {
        systemPrompt:
          "You are a B2B marketing strategist reviewing a campaign document for internal consistency. Be conservative — only flag genuine inconsistencies. Return JSON only.",
        maxTurns: 1,
      },
    })) {
      if ("result" in message) rippleResult = message.result;
    }
    ripple = parseJson(rippleResult) ?? ripple;
  } catch (err) {
    console.error("Ripple analysis failed:", err);
  }

  // Persist the updated design with the direct change
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { interactiveDesign: true },
    });
    if (campaign?.interactiveDesign) {
      const design = JSON.parse(campaign.interactiveDesign);
      if (design.blocks && blockIndex < design.blocks.length) {
        design.blocks[blockIndex] = updatedBlock;
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { interactiveDesign: JSON.stringify(design) },
        });
      }
    }
  } catch {
    // Non-fatal
  }

  return NextResponse.json({ updatedBlock, ripple });
}

// ── Legacy: Refine markdown section + ripple ────────────────────────

async function handleRefine(
  campaignId: string,
  body: {
    sectionTitle: string;
    sectionContent: string;
    userMessage: string;
    allSections: Array<{ stepNumber: number; title: string; content: string }>;
  }
) {
  const { sectionTitle, sectionContent, userMessage, allSections } = body;

  if (!sectionContent || !userMessage) {
    return NextResponse.json(
      { error: "sectionContent and userMessage are required" },
      { status: 400 }
    );
  }

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
      const items = entries
        .map((e) => `- [id:${e.id}] **${e.title}**: ${e.content}`)
        .join("\n");
      return `### ${getAreaLabel(area)}\n${items}`;
    })
    .join("\n\n");

  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  let updatedContent = "";
  try {
    for await (const message of query({
      prompt: [
        `## Section: ${sectionTitle}`,
        "",
        "### Current content:",
        sectionContent,
        "",
        "### User feedback:",
        userMessage,
        "",
        "Return the updated section content only. No preamble.",
      ].join("\n"),
      options: {
        systemPrompt:
          "You are a B2B marketing strategist editing a campaign direction document. Update the section according to the user's feedback. Return ONLY the updated markdown content.",
        maxTurns: 1,
      },
    })) {
      if ("result" in message) updatedContent = message.result;
    }
  } catch (err) {
    console.error("Section refinement failed:", err);
    return NextResponse.json({ error: "Refinement failed" }, { status: 500 });
  }

  const otherSections = (allSections ?? [])
    .filter((s) => s.title !== sectionTitle)
    .map((s) => `### Step ${s.stepNumber}: ${s.title}\n${s.content}`)
    .join("\n\n---\n\n");

  const ripplePrompt = [
    `A section in a campaign direction document was just changed.`,
    "",
    `## Changed section: ${sectionTitle}`,
    "",
    "### User's feedback:",
    userMessage,
    "",
    "### Updated content:",
    updatedContent,
    "",
    "---",
    "",
    "## Other sections:",
    otherSections,
    "",
    "---",
    "",
    "## Program context:",
    programContext || "(empty)",
    "",
    "---",
    "",
    "Return JSON: { \"sectionChanges\": [...], \"contextChanges\": [...], \"summary\": \"...\" }",
    "Only flag genuine inconsistencies. Return empty arrays if nothing needs changing.",
  ].join("\n");

  let ripple = {
    sectionChanges: [],
    contextChanges: [],
    summary: "No ripple effects needed.",
  };

  try {
    let rippleResult = "";
    for await (const message of query({
      prompt: ripplePrompt,
      options: {
        systemPrompt:
          "You are a B2B marketing strategist reviewing consistency. Be conservative. Return JSON only.",
        maxTurns: 1,
      },
    })) {
      if ("result" in message) rippleResult = message.result;
    }
    ripple = parseJson(rippleResult) ?? ripple;
  } catch (err) {
    console.error("Ripple analysis failed:", err);
  }

  return NextResponse.json({ updatedContent, ripple });
}

// ── Apply confirmed changes ─────────────────────────────────────────

async function handleApply(
  campaignId: string,
  body: {
    sectionChanges?: Array<{ stepNumber: number; updatedContent: string }>;
    contextChanges?: Array<{
      entryId: string | null;
      title: string;
      area: string;
      content: string;
      action: "update" | "delete";
    }>;
  }
) {
  for (const change of body.sectionChanges ?? []) {
    const step = await prisma.stepState.findFirst({
      where: { campaignId, stepNumber: change.stepNumber },
    });
    if (step) {
      await prisma.stepState.update({
        where: { id: step.id },
        data: {
          aiDraft: change.updatedContent,
          ...(step.finalOutput ? { finalOutput: change.updatedContent } : {}),
        },
      });
    }
  }

  for (const change of body.contextChanges ?? []) {
    if (change.action === "delete" && change.entryId) {
      await prisma.knowledgeEntry.delete({ where: { id: change.entryId } }).catch(() => {});
    } else if (change.action === "update" && change.entryId) {
      await prisma.knowledgeEntry
        .update({
          where: { id: change.entryId },
          data: { title: change.title, content: change.content },
        })
        .catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}

// ── Helpers ──────────────────────────────────────────────────────────

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    /* next */
  }
  const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch { /* next */ }
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch { /* fallback */ }
  }
  return null;
}
