import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET  — returns existing design (or null)
 * POST — generates a new immersive design from step outputs
 */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { interactiveDesign: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const design = campaign.interactiveDesign
    ? JSON.parse(campaign.interactiveDesign)
    : null;
  return NextResponse.json({ design });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stepDefs = await prisma.stepDef.findMany({
    where: { enabled: true },
    orderBy: { number: "asc" },
  });
  const defMap = new Map(stepDefs.map((d) => [d.number, d]));

  // Gather all step content including gaps and decisions
  const stepContents = campaign.steps
    .filter((s) => s.finalOutput || s.aiDraft)
    .map((s) => {
      const def = defMap.get(s.stepNumber);
      return {
        stepNumber: s.stepNumber,
        title: def?.title ?? `Step ${s.stepNumber}`,
        shortTitle: def?.shortTitle ?? `Step ${s.stepNumber}`,
        content: s.finalOutput || s.aiDraft || "",
        knowledgeGaps: s.knowledgeGaps,
        decisions: s.decisions,
      };
    });

  if (stepContents.length === 0) {
    return NextResponse.json(
      { error: "No step outputs to design from" },
      { status: 400 }
    );
  }

  // Collect all gaps and decisions across steps
  const allGaps: { stepTitle: string; id: string; title: string; description: string; category: string; resolved: boolean; resolution?: string }[] = [];
  const allDecisions: { stepTitle: string; id: string; title: string; description: string; options: string[]; recommendation: string; reasoning: string; chosen?: string }[] = [];

  for (const step of stepContents) {
    const gaps = JSON.parse(step.knowledgeGaps || "[]");
    const decisions = JSON.parse(step.decisions || "[]");
    for (const g of gaps) allGaps.push({ ...g, stepTitle: step.shortTitle });
    for (const d of decisions) allDecisions.push({ ...d, stepTitle: step.shortTitle });
  }

  const gapsSection = allGaps.length > 0
    ? `\n\n=== KNOWLEDGE GAPS (across all steps) ===\n${allGaps.map((g) => `- [${g.resolved ? "RESOLVED" : g.category.toUpperCase()}] ${g.title} (from: ${g.stepTitle})\n  ${g.description}${g.resolved && g.resolution ? `\n  Resolution: ${g.resolution}` : ""}`).join("\n")}`
    : "";

  const decisionsSection = allDecisions.length > 0
    ? `\n\n=== DECISIONS (across all steps) ===\n${allDecisions.map((d) => `- [${d.chosen ? "DECIDED: " + d.chosen : "PENDING"}] ${d.title} (from: ${d.stepTitle})\n  ${d.description}\n  Options: ${d.options.join(", ")}${d.recommendation ? `\n  Recommendation: ${d.recommendation}` : ""}${d.reasoning ? `\n  Reasoning: ${d.reasoning}` : ""}`).join("\n")}`
    : "";

  const allContent = stepContents
    .map(
      (s) =>
        `=== STEP ${s.stepNumber}: ${s.title} (${s.shortTitle}) ===\n${s.content}`
    )
    .join("\n\n---\n\n") + gapsSection + decisionsSection;

  const { query } = await import("@anthropic-ai/claude-agent-sdk");

  const systemPrompt = `You are a world-class editorial designer creating immersive, magazine-quality reading experiences for B2B campaign strategy documents.

Given a set of campaign direction-setting step outputs, you will design a beautiful, chapter-based reading experience by organizing the content into a sequence of visual blocks.

Available block types:

1. "hero" — Full-width opening. Fields: title, subtitle, abstract (2-3 sentence teaser)
2. "chapter" — Chapter divider. Fields: number, title, subtitle (optional)
3. "prose" — Flowing text paragraphs. Fields: content (markdown)
4. "stats" — Key metrics/numbers grid (2-6 items). Fields: items[] with { value, label, description? }
5. "cards" — Grid of distinct items (2-8). Fields: columns (2|3), items[] with { title, content, badge? }
6. "quote" — Highlighted pull-quote or key insight. Fields: text, attribution (optional)
7. "two-column" — Side-by-side comparison or contrast. Fields: left { title, content }, right { title, content }
8. "callout" — Highlighted box for warnings, key points, or strategic imperatives. Fields: title, content, variant ("insight" | "warning" | "opportunity")
9. "table" — Data table. Fields: caption (optional), headers[], rows[][]
10. "list" — Titled list of items. Fields: title, variant ("numbered" | "check" | "arrow"), items[] with { title, description? }
11. "divider" — Visual breathing space between chapters. No fields needed.
12. "accordion" — Expandable items for dense detail (click to reveal). Great for technical specs, boundaries, detailed features. Fields: title (section heading), items[] with { title, content (markdown), badge? (short label like "HIGH", "Critical"), open? (boolean, default false for first item only) }
13. "scored-list" — Ranked/scored items with numeric scores, labels, and sublabels. Great for prioritized pain points, ranked opportunities. Fields: title, items[] with { score (number or string), label, sublabel?, badge?, variant? ("red"|"orange"|"green" — auto-derived from score if omitted) }
14. "segment-cards" — Rich segment/persona cards with tier badges, star ratings, metadata. Fields: items[] with { tier (e.g. "1A"), name, message (italic positioning statement), metrics: { label: value }[] (e.g. revenue, urgency, fit as key-value pairs) }
15. "timeline" — Quarterly/phased timeline with grouped events. Fields: title, periods[] with { label (e.g. "Q2 2026"), status ("past"|"current"|"future"), items[] with { text, badge? (category label), variant? ("red"|"orange"|"green") } }
16. "tabs" — Tabbed panel to organize categories of content. Fields: tabs[] with { label, items[] with { title, content (markdown) } }
17. "direction-cards" — GET/TO/BY campaign direction statement cards. Fields: items[] with { segment, get, to, by, target?, priority? ("Primary"|"Secondary"|"Cross-cutting") }
18. "comparison" — Side-by-side comparison for competitors or alternatives (strengths/weaknesses/advantages). Fields: items[] with { name, badge? (e.g. "HIGH"), fields: { label: content }[] (e.g. "Strengths": "...", "Weaknesses": "...") }
19. "phases" — Campaign phases or timeline blocks in a row. Fields: items[] with { label, sublabel?, description? }

CRITICAL RULES — CONTENT COMPLETENESS:
- You MUST include ALL content from every step output. The content has already been curated by the user — nothing should be summarized, shortened, or omitted.
- Every fact, bullet point, data point, paragraph, and detail from the step outputs must appear in the final design. If a step output has 20 bullet points, all 20 must be present.
- When in doubt, use prose blocks to include full text verbatim rather than risk losing detail.
- It is acceptable (and expected) for the design to be long. Completeness is more important than brevity.

Design rules:
- Create 4-7 chapters that tell a strategic narrative (you may reorganize across steps, but never drop content)
- Vary block types aggressively — use many different block types, never the same type twice in a row
- Use "accordion" for technical details, feature lists, or anything with 5+ items that benefit from expand/collapse
- Use "scored-list" when items have natural rankings, scores, or priority levels
- Use "segment-cards" for target audience segments, ICPs, or personas with multiple attributes
- Use "timeline" when there are dated events, milestones, or phased plans
- Use "tabs" to organize technical capabilities, product features, or categorized content
- Use "direction-cards" for GET/TO/BY statements or similar strategic frameworks
- Use "comparison" for competitor analysis, alternative evaluation, or any strengths/weaknesses analysis
- Use "phases" for campaign arcs, project phases, or sequential stages
- Pull out impactful numbers for "stats" blocks, but ALSO keep the surrounding context
- Extract key strategic insights for "quote" blocks
- Use "two-column" for natural contrasts
- Use "callout" sparingly for genuinely important strategic points
- Use "cards" for parallel items that each need a title + description
- Write a compelling hero that frames the strategic challenge
- Every block must contain real content from the steps — never use placeholder text
- Use multiple prose blocks if needed to include all content — do not truncate
- Prefer structured block types (accordion, scored-list, tabs, segment-cards) over plain prose whenever the content has structure
- If there are knowledge gaps or decisions, include them as a dedicated final chapter (e.g. "Open Questions & Decisions"). Use scored-list for gaps (with severity as score) and cards or accordion for decisions showing options, recommendation, and current status. This chapter is critical — the user needs to see and interact with these.

Return a JSON array of blocks. Each block has a "type" field plus the type-specific fields described above. Also include a "sourceSteps" field (array of step numbers) for each block indicating which steps the content came from.

Return ONLY the JSON array — no markdown fences, no preamble.`;

  const prompt = `Design an immersive reading experience for the campaign "${campaign.name}".

Here is all the step output content:

${allContent}

Return the JSON array of blocks.`;

  try {
    const allBlocks: Record<string, unknown>[] = [];

    // Hero block
    allBlocks.push({
      type: "hero",
      title: campaign.name,
      subtitle: campaign.description || "Campaign Direction",
      abstract: "",
      sourceSteps: [1],
    });

    // Process each step individually — reliable, always works
    let chapterNum = 0;
    for (const step of stepContents) {
      chapterNum++;

      // Add chapter divider for each step
      allBlocks.push({
        type: "chapter",
        number: chapterNum,
        title: step.title,
        subtitle: step.shortTitle,
        sourceSteps: [step.stepNumber],
      });

      const stepPrompt = `Convert this campaign strategy content into rich dashboard blocks.

CONTENT (include ALL details — do not summarize or omit anything):

${step.content}

You are building a DASHBOARD, not a document. Every piece of content must be in a structured, interactive module.

BLOCK TYPE SELECTION — use this decision tree:
- Lists of items with paragraphs of detail → "accordion" (expandable, click to reveal)
- Ranked/scored/prioritized items → "scored-list" (numeric scores, color severity)
- Market segments, personas, ICPs with attributes → "segment-cards" (tier badges, metrics)
- Dated events, milestones, timelines → "timeline" (grouped by quarter/phase)
- Categorized groups of features → "tabs" (one tab per category, accordion items inside)
- GET/TO/BY campaign directions → "direction-cards" (structured statement cards)
- Competitor analysis, comparisons → "comparison" (expandable field grids)
- Phases, stages, arcs → "phases" (colored blocks in a row)
- Key metrics (2-6 numbers) → "stats" (big numbers grid)
- Key insight or pull-quote → "quote"
- Strategic warnings/opportunities → "callout" (variant: insight|warning|opportunity)
- Side-by-side contrast → "two-column"
- Parallel items with title+description → "cards"
- Tabular data → "table"
- Only narrative paragraphs with no structure → "prose" (MAX 1 per response)

RULES:
- Use at least 3 different block types
- Maximum 1 prose block — convert everything else to structured types
- Bullet points MUST become accordion, list, scored-list, or cards — never prose
- Include ALL content — completeness over brevity

Return ONLY a JSON array of blocks. No markdown fences, no explanation.`;

      let result = "";
      for await (const message of query({
        prompt: stepPrompt,
        options: { systemPrompt, maxTurns: 3 },
      })) {
        if ("result" in message) result = message.result;
      }

      const blocks = parseJsonArray(result);
      if (blocks && blocks.length > 0) {
        for (const block of blocks) {
          if (block.type !== "hero" && block.type !== "chapter") {
            allBlocks.push({ ...block, sourceSteps: [step.stepNumber] });
          }
        }
        console.log(`Step ${step.stepNumber} (${step.shortTitle}): ${blocks.length} blocks generated`);
      } else {
        console.error(`Step ${step.stepNumber} failed (result len=${result.length}). Prose fallback.`);
        allBlocks.push({ type: "prose", content: step.content, sourceSteps: [step.stepNumber] });
      }
    }

    // Add gaps & decisions as final chapter if they exist
    if (gapsSection || decisionsSection) {
      chapterNum++;
      allBlocks.push({
        type: "chapter",
        number: chapterNum,
        title: "Open Questions & Decisions",
        subtitle: `${allGaps.length} knowledge gaps, ${allDecisions.length} decisions`,
        sourceSteps: [],
      });

      const gapsContent = gapsSection + decisionsSection;
      let gapsResult = "";
      for await (const message of query({
        prompt: `Convert these knowledge gaps and decisions into dashboard blocks.

${gapsContent}

Use scored-list for gaps (severity as score). Use accordion or cards for decisions (showing options, recommendation, status). Return ONLY a JSON array.`,
        options: { systemPrompt, maxTurns: 3 },
      })) {
        if ("result" in message) gapsResult = message.result;
      }

      const gapsBlocks = parseJsonArray(gapsResult);
      if (gapsBlocks && gapsBlocks.length > 0) {
        for (const block of gapsBlocks) {
          if (block.type !== "hero" && block.type !== "chapter") {
            allBlocks.push({ ...block, sourceSteps: [] });
          }
        }
      } else {
        allBlocks.push({ type: "prose", content: gapsContent, sourceSteps: [] });
      }
    }

    const blocks = allBlocks;
    if (blocks.length <= 1) {
      console.error("Design generation produced no content blocks");
      return NextResponse.json(
        { error: "Failed to generate design" },
        { status: 500 }
      );
    }

    const design = {
      campaignName: campaign.name,
      generatedAt: new Date().toISOString(),
      blocks,
    };

    // Persist to DB
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { interactiveDesign: JSON.stringify(design) },
    });

    // Auto-save all exports to data/ for git
    try {
      const saveUrl = new URL(`/api/campaigns/${campaignId}/export`, req.url);
      await fetch(saveUrl.toString(), { method: "POST" });
    } catch { /* non-fatal */ }

    return NextResponse.json({ design });
  } catch (err) {
    console.error("Design generation failed:", err);
    return NextResponse.json(
      { error: "Design generation failed" },
      { status: 500 }
    );
  }
}

function parseJsonArray(text: string) {
  // Try direct parse
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.blocks && Array.isArray(parsed.blocks)) return parsed.blocks;
  } catch {
    /* next */
  }

  // Try extracting from markdown fence
  const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1]);
      if (Array.isArray(parsed)) return parsed;
      if (parsed.blocks) return parsed.blocks;
    } catch {
      /* next */
    }
  }

  // Try finding array
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0]);
    } catch {
      /* fallback */
    }
  }

  return null;
}
