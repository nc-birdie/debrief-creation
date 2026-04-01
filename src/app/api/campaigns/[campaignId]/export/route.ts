import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAreaLabel } from "@/lib/knowledge-areas";
import fs from "node:fs";
import path from "node:path";

/**
 * GET /api/campaigns/[campaignId]/export
 *
 * Query params:
 *   ?type=steps          — (default) all step outputs as markdown
 *   ?type=context         — knowledge entries grouped by area
 *   ?type=interactive     — interactive design as markdown
 *   ?step=5               — single step export
 *   &save=true            — also save to data/campaigns/<slug>/ for git
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const url = new URL(req.url);
  const exportType = url.searchParams.get("type") ?? "steps";
  const stepParam = url.searchParams.get("step");
  const shouldSave = url.searchParams.get("save") === "true";

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      steps: { orderBy: { stepNumber: "asc" } },
      knowledgeEntries: {
        include: { source: { select: { name: true } } },
        orderBy: [{ area: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stepDefs = await prisma.stepDef.findMany({ orderBy: { number: "asc" } });
  const defMap = new Map(stepDefs.map((d) => [d.number, d]));
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  // ── Context export ──
  if (exportType === "context") {
    const entriesByArea = new Map<string, typeof campaign.knowledgeEntries>();
    for (const entry of campaign.knowledgeEntries) {
      const list = entriesByArea.get(entry.area) ?? [];
      list.push(entry);
      entriesByArea.set(entry.area, list);
    }

    const lines = [
      `# ${campaign.name} — Program Context`,
      "",
      `> Exported ${date}`,
      `> ${campaign.knowledgeEntries.length} entries across ${entriesByArea.size} areas`,
      "",
      "---",
      "",
    ];

    for (const [area, entries] of entriesByArea) {
      lines.push(`## ${getAreaLabel(area)}`);
      lines.push("");
      for (const entry of entries) {
        lines.push(`### ${entry.title}`);
        lines.push("");
        lines.push(entry.content);
        if (entry.source?.name) {
          lines.push("");
          lines.push(`*Source: ${entry.source.name}*`);
        }
        lines.push("");
      }
      lines.push("---");
      lines.push("");
    }

    const md = lines.join("\n");
    const filename = `${campaign.slug}-context.md`;

    if (shouldSave) saveToDataDir(campaign.slug, filename, md);

    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // ── Interactive design export ──
  if (exportType === "interactive") {
    const design = campaign.interactiveDesign
      ? JSON.parse(campaign.interactiveDesign)
      : null;

    if (!design || !design.blocks) {
      return NextResponse.json(
        { error: "No interactive design exists yet" },
        { status: 404 }
      );
    }

    const lines = [
      `# ${campaign.name} — Interactive Review`,
      "",
      `> Exported ${date}`,
      "",
      "---",
      "",
    ];

    for (const block of design.blocks) {
      lines.push(blockToMarkdown(block));
      lines.push("");
    }

    const md = lines.join("\n");
    const filename = `${campaign.slug}-interactive.md`;

    if (shouldSave) saveToDataDir(campaign.slug, filename, md);

    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // ── Single step export ──
  if (stepParam) {
    const stepNumber = parseInt(stepParam, 10);
    const step = campaign.steps.find((s) => s.stepNumber === stepNumber);
    if (!step) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 });
    }

    const def = defMap.get(stepNumber);
    const title = def?.title ?? `Step ${stepNumber}`;
    const shortTitle = def?.shortTitle ?? `Step ${stepNumber}`;
    const content = step.finalOutput || step.aiDraft || "";
    const md = `# Step ${stepNumber}: ${title}\n\n${content}\n`;
    const filename = `${campaign.slug}-step-${stepNumber}-${slugify(shortTitle)}.md`;

    if (shouldSave) saveToDataDir(campaign.slug, filename, md);

    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // ── Full steps export (default) ──
  const lines: string[] = [
    `# ${campaign.name}`,
    "",
    `> Exported ${date}`,
    "",
    "---",
    "",
  ];

  for (const step of campaign.steps) {
    const def = defMap.get(step.stepNumber);
    const title = def?.title ?? `Step ${step.stepNumber}`;
    const content = step.finalOutput || step.aiDraft;
    if (!content) continue;

    const statusTag = step.status === "approved" ? "" : ` *(${step.status})*`;
    lines.push(`## Step ${step.stepNumber}: ${title}${statusTag}`);
    lines.push("");
    lines.push(content);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  const md = lines.join("\n");
  const filename = `${campaign.slug}-full-export.md`;

  if (shouldSave) saveToDataDir(campaign.slug, filename, md);

  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

// ── Auto-save all exports for a campaign ──

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      steps: { orderBy: { stepNumber: "asc" } },
      knowledgeEntries: {
        include: { source: { select: { name: true } } },
        orderBy: [{ area: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stepDefs = await prisma.stepDef.findMany({ orderBy: { number: "asc" } });
  const defMap = new Map(stepDefs.map((d) => [d.number, d]));
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const saved: string[] = [];

  // Save steps export
  const stepLines = [`# ${campaign.name}`, "", `> Exported ${date}`, "", "---", ""];
  for (const step of campaign.steps) {
    const def = defMap.get(step.stepNumber);
    const content = step.finalOutput || step.aiDraft;
    if (!content) continue;
    const statusTag = step.status === "approved" ? "" : ` *(${step.status})*`;
    stepLines.push(`## Step ${step.stepNumber}: ${def?.title ?? `Step ${step.stepNumber}`}${statusTag}`, "", content, "", "---", "");
  }
  if (stepLines.length > 6) {
    saveToDataDir(campaign.slug, `${campaign.slug}-full-export.md`, stepLines.join("\n"));
    saved.push("steps");
  }

  // Save context export
  const entriesByArea = new Map<string, typeof campaign.knowledgeEntries>();
  for (const entry of campaign.knowledgeEntries) {
    const list = entriesByArea.get(entry.area) ?? [];
    list.push(entry);
    entriesByArea.set(entry.area, list);
  }
  if (campaign.knowledgeEntries.length > 0) {
    const ctxLines = [`# ${campaign.name} — Program Context`, "", `> Exported ${date}`, `> ${campaign.knowledgeEntries.length} entries across ${entriesByArea.size} areas`, "", "---", ""];
    for (const [area, entries] of entriesByArea) {
      ctxLines.push(`## ${getAreaLabel(area)}`, "");
      for (const entry of entries) {
        ctxLines.push(`### ${entry.title}`, "", entry.content);
        if (entry.source?.name) ctxLines.push("", `*Source: ${entry.source.name}*`);
        ctxLines.push("");
      }
      ctxLines.push("---", "");
    }
    saveToDataDir(campaign.slug, `${campaign.slug}-context.md`, ctxLines.join("\n"));
    saved.push("context");
  }

  // Save interactive design export
  if (campaign.interactiveDesign) {
    const design = JSON.parse(campaign.interactiveDesign);
    if (design.blocks) {
      const intLines = [`# ${campaign.name} — Interactive Review`, "", `> Exported ${date}`, "", "---", ""];
      for (const block of design.blocks) {
        intLines.push(blockToMarkdown(block), "");
      }
      saveToDataDir(campaign.slug, `${campaign.slug}-interactive.md`, intLines.join("\n"));
      saved.push("interactive");
    }
  }

  return NextResponse.json({ saved, count: saved.length });
}

// ── Helpers ──

function saveToDataDir(slug: string, filename: string, content: string) {
  const dir = path.join(process.cwd(), "data", "campaigns", slug, "exports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), content, "utf-8");
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function blockToMarkdown(block: Record<string, unknown>): string {
  const type = block.type as string;
  switch (type) {
    case "hero": return `# ${block.title}\n\n*${block.subtitle}*\n\n${block.abstract}`;
    case "chapter": return `## Chapter ${block.number}: ${block.title}${block.subtitle ? `\n\n*${block.subtitle}*` : ""}`;
    case "prose": return block.content as string;
    case "quote": return `> "${block.text}"${block.attribution ? `\n> — ${block.attribution}` : ""}`;
    case "stats": return (block.items as { value: string; label: string }[]).map((s) => `- **${s.value}** — ${s.label}`).join("\n");
    case "cards": return (block.items as { title: string; content: string }[]).map((c) => `### ${c.title}\n${c.content}`).join("\n\n");
    case "two-column": { const b = block as { left: { title: string; content: string }; right: { title: string; content: string } }; return `### ${b.left.title}\n${b.left.content}\n\n### ${b.right.title}\n${b.right.content}`; }
    case "callout": return `> **${block.title}**\n> ${block.content}`;
    case "table": { const b = block as { headers: string[]; rows: string[][] }; return b.headers.length ? [`| ${b.headers.join(" | ")} |`, `| ${b.headers.map(() => "---").join(" | ")} |`, ...b.rows.map((r) => `| ${r.join(" | ")} |`)].join("\n") : ""; }
    case "list": return (block.items as { title: string; description?: string }[]).map((it, i) => `${i + 1}. **${it.title}**${it.description ? ` — ${it.description}` : ""}`).join("\n");
    case "accordion": return `### ${block.title}\n${(block.items as { title: string; content: string }[]).map((it) => `#### ${it.title}\n${it.content}`).join("\n\n")}`;
    case "scored-list": return `### ${block.title}\n${(block.items as { score: string | number; label: string; sublabel?: string }[]).map((it) => `- [${it.score}] **${it.label}**${it.sublabel ? ` — ${it.sublabel}` : ""}`).join("\n")}`;
    case "segment-cards": return (block.items as { tier: string; name: string; message: string; metrics: Record<string, string> }[]).map((s) => `### [Tier ${s.tier}] ${s.name}\n*${s.message}*\n${Object.entries(s.metrics).map(([k, v]) => `- ${k}: ${v}`).join("\n")}`).join("\n\n");
    case "timeline": return `### ${block.title}\n${(block.periods as { label: string; items: { text: string }[] }[]).map((p) => `#### ${p.label}\n${p.items.map((it) => `- ${it.text}`).join("\n")}`).join("\n\n")}`;
    case "tabs": return (block.tabs as { label: string; items: { title: string; content: string }[] }[]).map((t) => `### ${t.label}\n${t.items.map((it) => `#### ${it.title}\n${it.content}`).join("\n\n")}`).join("\n\n");
    case "direction-cards": return (block.items as { segment: string; get: string; to: string; by: string }[]).map((d) => `### ${d.segment}\n**GET** ${d.get}\n**TO** ${d.to}\n**BY** ${d.by}`).join("\n\n");
    case "comparison": return (block.items as { name: string; fields: Record<string, string> }[]).map((c) => `### ${c.name}\n${Object.entries(c.fields).map(([k, v]) => `**${k}:** ${v}`).join("\n")}`).join("\n\n");
    case "phases": return (block.items as { label: string; sublabel?: string; description?: string }[]).map((p) => `- **${p.label}**${p.sublabel ? ` (${p.sublabel})` : ""}${p.description ? ` — ${p.description}` : ""}`).join("\n");
    case "divider": return "---";
    default: return "";
  }
}
