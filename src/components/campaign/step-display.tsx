"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { RenderedMarkdown } from "./rendered-markdown";

interface StepDisplayProps {
  content: string;
  displayType: string;
  className?: string;
}

export function StepDisplay({ content, displayType, className }: StepDisplayProps) {
  switch (displayType) {
    case "bullet-cards":
      return <BulletCards content={content} className={className} />;
    case "table":
      return <TableDisplay content={content} className={className} />;
    case "kpi-grid":
      return <KpiGrid content={content} className={className} />;
    case "statement-cards":
      return <StatementCards content={content} className={className} />;
    case "swot-grid":
      return <SwotGrid content={content} className={className} />;
    case "timeline":
      return <Timeline content={content} className={className} />;
    case "comparison":
      return <Comparison content={content} className={className} />;
    case "checklist":
      return <Checklist content={content} className={className} />;
    case "ranked-list":
      return <RankedList content={content} className={className} />;
    case "prose":
    default:
      return <RenderedMarkdown content={content} className={className} />;
  }
}

// ── Bullet Cards ──
// Parses h3 sections into individual cards

function BulletCards({ content, className }: { content: string; className?: string }) {
  const cards = useMemo(() => parseH3Sections(content), [content]);

  if (cards.length === 0) {
    return <RenderedMarkdown content={content} className={className} />;
  }

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-3", className)}>
      {cards.map((card, i) => (
        <div
          key={i}
          className="rounded-lg border border-border p-4 space-y-2 hover:border-primary/20 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold">{card.title}</h4>
            {card.badge && (
              <span className="shrink-0 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
                {card.badge}
              </span>
            )}
          </div>
          {card.metadata.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {card.metadata.map((m, j) => (
                <span key={j} className="text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground/70">{m.key}:</span>{" "}
                  {m.value}
                </span>
              ))}
            </div>
          )}
          {card.body && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {card.body}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── KPI Grid ──
// Similar to bullet cards but styled as metric tiles

function KpiGrid({ content, className }: { content: string; className?: string }) {
  const cards = useMemo(() => parseH3Sections(content), [content]);

  if (cards.length === 0) {
    return <RenderedMarkdown content={content} className={className} />;
  }

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3", className)}>
      {cards.map((card, i) => {
        const target = card.metadata.find(
          (m) => m.key.toLowerCase() === "target" || m.key.toLowerCase() === "kpi"
        );
        const category = card.metadata.find(
          (m) => m.key.toLowerCase() === "category"
        );
        const confidence = card.metadata.find(
          (m) => m.key.toLowerCase() === "confidence"
        );

        return (
          <div
            key={i}
            className="rounded-lg border border-border p-4 space-y-2"
          >
            {category && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {category.value}
              </span>
            )}
            <h4 className="text-sm font-semibold">{card.title}</h4>
            {target && (
              <div className="text-lg font-bold text-primary">
                {target.value}
              </div>
            )}
            {card.metadata
              .filter((m) => m !== target && m !== category && m !== confidence)
              .map((m, j) => (
                <div key={j} className="text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground/70">{m.key}:</span>{" "}
                  {m.value}
                </div>
              ))}
            {card.body && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {card.body}
              </p>
            )}
            {confidence && (
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    confidence.value.toLowerCase().includes("high")
                      ? "bg-primary"
                      : confidence.value.toLowerCase().includes("low")
                        ? "bg-muted-foreground/40"
                        : "bg-amber-500"
                  )}
                />
                <span className="text-[10px] text-muted-foreground">
                  {confidence.value} confidence
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Statement Cards ──
// For "Get to, by" — large cards with emphasized structure

function StatementCards({ content, className }: { content: string; className?: string }) {
  const cards = useMemo(() => parseH3Sections(content), [content]);

  if (cards.length === 0) {
    return <RenderedMarkdown content={content} className={className} />;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {cards.map((card, i) => {
        // Extract Get/To/By from metadata
        const getLine = card.metadata.find(
          (m) => m.key.toLowerCase() === "get"
        );
        const toLine = card.metadata.find(
          (m) => m.key.toLowerCase() === "to"
        );
        const byLine = card.metadata.find(
          (m) => m.key.toLowerCase() === "by"
        );
        const otherMeta = card.metadata.filter(
          (m) => m !== getLine && m !== toLine && m !== byLine
        );

        return (
          <div
            key={i}
            className="rounded-lg border border-border p-5 space-y-3"
          >
            <h4 className="text-sm font-bold">{card.title}</h4>

            {(getLine || toLine || byLine) && (
              <div className="rounded-md bg-secondary/50 p-4 space-y-2">
                {getLine && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider shrink-0 w-8">
                      Get
                    </span>
                    <span className="text-sm">{getLine.value}</span>
                  </div>
                )}
                {toLine && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider shrink-0 w-8">
                      To
                    </span>
                    <span className="text-sm">{toLine.value}</span>
                  </div>
                )}
                {byLine && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider shrink-0 w-8">
                      By
                    </span>
                    <span className="text-sm">{byLine.value}</span>
                  </div>
                )}
              </div>
            )}

            {otherMeta.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {otherMeta.map((m, j) => (
                  <span key={j} className="text-[10px] text-muted-foreground">
                    <span className="font-medium text-foreground/70">{m.key}:</span>{" "}
                    {m.value}
                  </span>
                ))}
              </div>
            )}

            {card.body && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {card.body}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Table Display ──
// Enhanced table rendering with better styling

function TableDisplay({ content, className }: { content: string; className?: string }) {
  // Split into pre-table text, table, and post-table text
  const parts = useMemo(() => {
    const lines = content.split("\n");
    let preTable = "";
    let tableLines: string[] = [];
    let postTable = "";
    let inTable = false;
    let pastTable = false;

    for (const line of lines) {
      if (!inTable && !pastTable && line.includes("|") && line.trim().startsWith("|")) {
        inTable = true;
        tableLines.push(line);
      } else if (inTable) {
        if (line.includes("|")) {
          tableLines.push(line);
        } else {
          inTable = false;
          pastTable = true;
          if (line.trim()) postTable += line + "\n";
        }
      } else if (pastTable) {
        postTable += line + "\n";
      } else {
        preTable += line + "\n";
      }
    }

    // Parse table
    let headers: string[] = [];
    let rows: string[][] = [];
    if (tableLines.length >= 2) {
      headers = tableLines[0].split("|").map((c) => c.trim()).filter(Boolean);
      // Skip separator line
      const dataStart = /^[\s|:-]+$/.test(tableLines[1]) ? 2 : 1;
      rows = tableLines.slice(dataStart).map((line) =>
        line.split("|").map((c) => c.trim()).filter(Boolean)
      );
    }

    return { preTable: preTable.trim(), headers, rows, postTable: postTable.trim() };
  }, [content]);

  return (
    <div className={cn("space-y-4", className)}>
      {parts.preTable && (
        <RenderedMarkdown content={parts.preTable} />
      )}

      {parts.headers.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/60">
                {parts.headers.map((h, i) => (
                  <th
                    key={i}
                    className="px-3 py-2.5 text-left font-semibold border-b border-border whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parts.rows.map((row, ri) => (
                <tr
                  key={ri}
                  className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors"
                >
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2.5">
                      <CellContent value={cell} isFirstCol={ci === 0} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {parts.postTable && (
        <RenderedMarkdown content={parts.postTable} />
      )}
    </div>
  );
}

// Smart cell rendering — badges for known patterns
function CellContent({ value, isFirstCol }: { value: string; isFirstCol: boolean }) {
  // Tier/Priority badges
  if (/^tier\s*[123]$/i.test(value.trim())) {
    const tier = value.trim().slice(-1);
    return (
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-medium",
          tier === "1"
            ? "bg-primary/15 text-primary"
            : tier === "2"
              ? "bg-secondary text-foreground/70"
              : "bg-secondary text-muted-foreground"
        )}
      >
        {value}
      </span>
    );
  }

  // High/Medium/Low badges
  if (/^(high|medium|med|low)$/i.test(value.trim())) {
    const level = value.trim().toLowerCase();
    return (
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-medium",
          level === "high"
            ? "bg-primary/15 text-primary"
            : level === "low"
              ? "bg-secondary text-muted-foreground"
              : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
        )}
      >
        {value}
      </span>
    );
  }

  // First column bold
  if (isFirstCol) {
    return <span className="font-medium">{value}</span>;
  }

  return <span>{value}</span>;
}

// ── SWOT Grid ──
// 2×2 quadrant analysis — expects h3 sections matching Strengths/Weaknesses/Opportunities/Threats

const SWOT_QUADRANTS = [
  { key: "strengths", label: "Strengths", color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400" },
  { key: "weaknesses", label: "Weaknesses", color: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400" },
  { key: "opportunities", label: "Opportunities", color: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400" },
  { key: "threats", label: "Threats", color: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400" },
];

function SwotGrid({ content, className }: { content: string; className?: string }) {
  const quadrants = useMemo(() => {
    const cards = parseH3Sections(content);
    return SWOT_QUADRANTS.map((q) => {
      const match = cards.find(
        (c) => c.title.toLowerCase().includes(q.key)
      );
      // Collect bullet points from body + metadata values
      const items: string[] = [];
      if (match) {
        // Parse bullet lines from the raw section
        const sectionMatch = content.split(/^###\s+/m).find(
          (s) => s.toLowerCase().startsWith(q.key) || s.toLowerCase().includes(q.label.toLowerCase())
        );
        if (sectionMatch) {
          for (const line of sectionMatch.split("\n")) {
            const bullet = line.match(/^[-*]\s+(.+)/);
            if (bullet) items.push(bullet[1].trim());
          }
        }
        // Fallback: use metadata values and body
        if (items.length === 0) {
          match.metadata.forEach((m) => items.push(`${m.key}: ${m.value}`));
          if (match.body) items.push(match.body);
        }
      }
      return { ...q, items };
    });
  }, [content]);

  const hasContent = quadrants.some((q) => q.items.length > 0);
  if (!hasContent) {
    return <RenderedMarkdown content={content} className={className} />;
  }

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {quadrants.map((q) => (
        <div
          key={q.key}
          className={cn("rounded-lg border p-4 space-y-2", q.color)}
        >
          <h4 className="text-xs font-bold uppercase tracking-wider">{q.label}</h4>
          {q.items.length > 0 ? (
            <ul className="space-y-1">
              {q.items.map((item, i) => (
                <li key={i} className="text-xs leading-relaxed flex items-start gap-1.5">
                  <span className="shrink-0 mt-1 h-1 w-1 rounded-full bg-current opacity-50" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[10px] italic opacity-50">No items</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Timeline ──
// Sequential phases/milestones — h3 sections rendered as a vertical timeline

function Timeline({ content, className }: { content: string; className?: string }) {
  const steps = useMemo(() => parseH3Sections(content), [content]);

  if (steps.length === 0) {
    return <RenderedMarkdown content={content} className={className} />;
  }

  return (
    <div className={cn("relative pl-6", className)}>
      {/* Vertical line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

      <div className="space-y-4">
        {steps.map((step, i) => {
          const timeline = step.metadata.find(
            (m) => ["timeline", "date", "when", "period", "duration"].includes(m.key.toLowerCase())
          );
          const status = step.metadata.find(
            (m) => m.key.toLowerCase() === "status"
          );
          const otherMeta = step.metadata.filter((m) => m !== timeline && m !== status);
          const isComplete = status?.value.toLowerCase().includes("complete") ||
                             status?.value.toLowerCase().includes("done");

          return (
            <div key={i} className="relative">
              {/* Dot */}
              <div
                className={cn(
                  "absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2",
                  isComplete
                    ? "bg-primary border-primary"
                    : i === 0
                      ? "bg-background border-primary"
                      : "bg-background border-border"
                )}
              />

              <div className="rounded-lg border border-border p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold">{step.title}</h4>
                  <div className="flex items-center gap-2 shrink-0">
                    {status && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          isComplete
                            ? "bg-primary/15 text-primary"
                            : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {status.value}
                      </span>
                    )}
                    {timeline && (
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {timeline.value}
                      </span>
                    )}
                  </div>
                </div>

                {otherMeta.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {otherMeta.map((m, j) => (
                      <span key={j} className="text-[10px] text-muted-foreground">
                        <span className="font-medium text-foreground/70">{m.key}:</span> {m.value}
                      </span>
                    ))}
                  </div>
                )}

                {step.body && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.body}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Comparison ──
// Side-by-side option comparison — h3 sections as columns with shared metadata dimensions

function Comparison({ content, className }: { content: string; className?: string }) {
  const options = useMemo(() => parseH3Sections(content), [content]);

  if (options.length < 2) {
    return <RenderedMarkdown content={content} className={className} />;
  }

  // Collect all unique metadata keys across options
  const allKeys = Array.from(
    new Set(options.flatMap((o) => o.metadata.map((m) => m.key)))
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-secondary/60">
              <th className="px-3 py-2.5 text-left font-semibold border-b border-border w-28" />
              {options.map((opt, i) => (
                <th key={i} className="px-3 py-2.5 text-left font-semibold border-b border-border">
                  <div className="flex items-center gap-2">
                    <span>{opt.title}</span>
                    {opt.badge && (
                      <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
                        {opt.badge}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allKeys.map((key, ki) => (
              <tr key={ki} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                  {key}
                </td>
                {options.map((opt, oi) => {
                  const val = opt.metadata.find(
                    (m) => m.key === key
                  )?.value ?? "—";
                  return (
                    <td key={oi} className="px-3 py-2">
                      <CellContent value={val} isFirstCol={false} />
                    </td>
                  );
                })}
              </tr>
            ))}
            {options.some((o) => o.body) && (
              <tr className="border-t border-border">
                <td className="px-3 py-2 font-medium text-muted-foreground align-top">
                  Summary
                </td>
                {options.map((opt, oi) => (
                  <td key={oi} className="px-3 py-2 text-muted-foreground">
                    {opt.body || "—"}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Checklist ──
// Action items with checkbox markers — parses - [ ] and - [x] syntax

function Checklist({ content, className }: { content: string; className?: string }) {
  const categories = useMemo(() => {
    const sections = content.split(/^###\s+/m).filter((s) => s.trim());

    if (sections.length === 0) {
      // No h3 headers — treat entire content as one category
      const items = parseChecklistItems(content);
      if (items.length === 0) return [];
      return [{ title: "", items }];
    }

    return sections.map((section) => {
      const lines = section.split("\n");
      const title = lines[0].trim();
      const rest = lines.slice(1).join("\n");
      return { title, items: parseChecklistItems(rest) };
    }).filter((c) => c.items.length > 0);
  }, [content]);

  if (categories.length === 0) {
    return <RenderedMarkdown content={content} className={className} />;
  }

  const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);
  const completedItems = categories.reduce(
    (sum, c) => sum + c.items.filter((i) => i.checked).length,
    0
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${totalItems > 0 ? (completedItems / totalItems) * 100 : 0}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground font-medium shrink-0">
          {completedItems}/{totalItems}
        </span>
      </div>

      {categories.map((cat, ci) => (
        <div key={ci} className="space-y-1.5">
          {cat.title && (
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {cat.title}
            </h4>
          )}
          <div className="space-y-1">
            {cat.items.map((item, ii) => (
              <div
                key={ii}
                className={cn(
                  "flex items-start gap-2.5 rounded-md border px-3 py-2 transition-colors",
                  item.checked
                    ? "border-primary/20 bg-primary/5"
                    : "border-border"
                )}
              >
                <div
                  className={cn(
                    "shrink-0 mt-0.5 h-3.5 w-3.5 rounded border flex items-center justify-center",
                    item.checked
                      ? "bg-primary border-primary"
                      : "border-border"
                  )}
                >
                  {item.checked && (
                    <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs leading-relaxed",
                    item.checked && "text-muted-foreground line-through"
                  )}
                >
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function parseChecklistItems(text: string): Array<{ text: string; checked: boolean }> {
  const items: Array<{ text: string; checked: boolean }> = [];
  for (const line of text.split("\n")) {
    const match = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)/);
    if (match) {
      items.push({ checked: match[1] !== " ", text: match[2].trim() });
    } else {
      // Also accept plain bullet items as unchecked
      const plain = line.match(/^[-*]\s+(.+)/);
      if (plain) {
        items.push({ checked: false, text: plain[1].trim() });
      }
    }
  }
  return items;
}

// ── Ranked List ──
// Prioritized items with rank numbers and optional scores

function RankedList({ content, className }: { content: string; className?: string }) {
  const items = useMemo(() => parseH3Sections(content), [content]);

  if (items.length === 0) {
    return <RenderedMarkdown content={content} className={className} />;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item, i) => {
        const score = item.metadata.find(
          (m) => ["score", "rating", "weight", "priority"].includes(m.key.toLowerCase())
        );
        const impact = item.metadata.find(
          (m) => ["impact", "value", "importance"].includes(m.key.toLowerCase())
        );
        const effort = item.metadata.find(
          (m) => ["effort", "cost", "complexity", "difficulty"].includes(m.key.toLowerCase())
        );
        const otherMeta = item.metadata.filter(
          (m) => m !== score && m !== impact && m !== effort
        );

        return (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg border border-border p-3 hover:border-primary/20 transition-colors"
          >
            {/* Rank number */}
            <div className="shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-secondary text-xs font-bold">
              {i + 1}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold truncate">{item.title}</h4>
                {score && (
                  <span className="shrink-0 text-sm font-bold text-primary">
                    {score.value}
                  </span>
                )}
              </div>

              {(impact || effort) && (
                <div className="flex items-center gap-3">
                  {impact && (
                    <span className="text-[10px]">
                      <span className="font-medium text-foreground/70">Impact:</span>{" "}
                      <CellContent value={impact.value} isFirstCol={false} />
                    </span>
                  )}
                  {effort && (
                    <span className="text-[10px]">
                      <span className="font-medium text-foreground/70">Effort:</span>{" "}
                      <CellContent value={effort.value} isFirstCol={false} />
                    </span>
                  )}
                </div>
              )}

              {otherMeta.length > 0 && (
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {otherMeta.map((m, j) => (
                    <span key={j} className="text-[10px] text-muted-foreground">
                      <span className="font-medium text-foreground/70">{m.key}:</span> {m.value}
                    </span>
                  ))}
                </div>
              )}

              {item.body && (
                <p className="text-xs text-muted-foreground leading-relaxed">{item.body}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Parsing helpers ──

interface ParsedCard {
  title: string;
  badge: string | null;
  metadata: Array<{ key: string; value: string }>;
  body: string;
}

function parseH3Sections(content: string): ParsedCard[] {
  const sections = content.split(/^###\s+/m).filter((s) => s.trim());
  return sections.map((section) => {
    const lines = section.split("\n");
    const titleLine = lines[0].trim();
    const rest = lines.slice(1).join("\n").trim();

    // Extract metadata (lines starting with **Key:** Value)
    const metadata: Array<{ key: string; value: string }> = [];
    const bodyLines: string[] = [];

    for (const line of rest.split("\n")) {
      const metaMatch = line.match(/^\*\*([^*]+)\*\*:?\s*(.+)/);
      if (metaMatch) {
        metadata.push({
          key: metaMatch[1].trim(),
          value: metaMatch[2].trim(),
        });
      } else if (line.trim()) {
        bodyLines.push(line);
      }
    }

    // Extract badge from metadata (Type, Category, Severity, Priority)
    const badgeKeys = ["type", "category", "severity", "priority", "criticality"];
    const badgeMeta = metadata.find((m) =>
      badgeKeys.includes(m.key.toLowerCase())
    );

    return {
      title: titleLine,
      badge: badgeMeta?.value ?? null,
      metadata: metadata.filter((m) => m !== badgeMeta),
      body: bodyLines.join(" ").replace(/\s+/g, " ").trim(),
    };
  });
}
