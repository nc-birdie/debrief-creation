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
