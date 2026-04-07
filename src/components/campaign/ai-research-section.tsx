"use client";

import { useState } from "react";
import {
  Search,
  Sparkles,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { BriefAssessment } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ResearchFinding {
  area: string;
  title: string;
  content: string;
  sources: string[];
}

interface ResearchResult {
  category: string;
  findings: ResearchFinding[];
  status: string;
}

interface AIResearchSectionProps {
  campaignId: string;
  briefAssessment: BriefAssessment | null;
  onRefresh: () => void;
}

export function AIResearchSection({
  campaignId,
  briefAssessment,
  onRefresh,
}: AIResearchSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [researching, setResearching] = useState(false);
  const [researchFindings, setResearchFindings] = useState<ResearchResult[]>([]);
  const [selectedFindings, setSelectedFindings] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const allFindings = researchFindings.flatMap((r, ci) =>
    r.findings.map((f, fi) => ({ ...f, key: `${ci}-${fi}`, category: r.category }))
  );
  const totalFound = allFindings.length;
  const selectedCount = selectedFindings.size;

  async function runResearch() {
    setResearching(true);
    setResearchFindings([]);
    setSelectedFindings(new Set());
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        const results: ResearchResult[] = data.agentResults ?? [];
        setResearchFindings(results);
        const allKeys = new Set<string>();
        results.forEach((r, ci) =>
          r.findings.forEach((_, fi) => allKeys.add(`${ci}-${fi}`))
        );
        setSelectedFindings(allKeys);
      }
    } catch {
      /* ignore */
    }
    setResearching(false);
  }

  async function importSelected() {
    const toImport = allFindings.filter((f) => selectedFindings.has(f.key));
    if (toImport.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: toImport.map((f) => ({
            area: f.area,
            title: f.title,
            content:
              f.sources && f.sources.length > 0
                ? `${f.content}\n\nSources:\n${f.sources.map((s) => `- ${s}`).join("\n")}`
                : f.content,
          })),
        }),
      });
      if (res.ok) {
        const remaining = researchFindings
          .map((r, ci) => ({
            ...r,
            findings: r.findings.filter(
              (_, fi) => !selectedFindings.has(`${ci}-${fi}`)
            ),
          }))
          .filter((r) => r.findings.length > 0);
        setResearchFindings(remaining);
        setSelectedFindings(new Set());
        await onRefresh();
      }
    } catch {
      /* ignore */
    }
    setImporting(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary shrink-0">
            <Search className="h-4 w-4 text-emerald-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">AI Research</h3>
              {totalFound > 0 && (
                <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-medium">
                  {totalFound} findings
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Search the web to fill knowledge gaps and enrich your program context
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-5 py-5 space-y-4">
          {/* Assessment summary */}
          {briefAssessment && totalFound === 0 && (
            <div className="rounded-md border border-border bg-secondary/30 p-4">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                Assessment Summary
              </h4>
              <div className="grid grid-cols-3 gap-3 text-center mb-3">
                <div className="rounded-md bg-card p-2">
                  <div className="text-lg font-bold text-green-600">
                    {briefAssessment.categories.reduce(
                      (s, c) =>
                        s +
                        c.questions.filter((q) => q.status === "covered").length,
                      0
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Covered
                  </div>
                </div>
                <div className="rounded-md bg-card p-2">
                  <div className="text-lg font-bold text-amber-600">
                    {briefAssessment.categories.reduce(
                      (s, c) =>
                        s +
                        c.questions.filter((q) => q.status === "partial").length,
                      0
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Partial
                  </div>
                </div>
                <div className="rounded-md bg-card p-2">
                  <div className="text-lg font-bold text-red-500">
                    {briefAssessment.categories.reduce(
                      (s, c) =>
                        s +
                        c.questions.filter((q) => q.status === "gap").length,
                      0
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Gaps</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {briefAssessment.summary}
              </p>
            </div>
          )}

          <button
            onClick={runResearch}
            disabled={researching}
            className="w-full flex items-center justify-center gap-2 rounded-md gradient-bg px-5 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {researching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Researching... This may take a few minutes
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {totalFound > 0 ? "Research Again" : "Start AI Research"}
              </>
            )}
          </button>

          {/* Findings review */}
          {totalFound > 0 && (
            <div className="rounded-lg border border-border">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/20">
                <span className="text-xs font-semibold">
                  Findings ({selectedCount} / {totalFound} selected)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (selectedCount === totalFound) {
                        setSelectedFindings(new Set());
                      } else {
                        setSelectedFindings(
                          new Set(allFindings.map((f) => f.key))
                        );
                      }
                    }}
                    className="text-[10px] text-primary hover:underline"
                  >
                    {selectedCount === totalFound
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                  <button
                    onClick={importSelected}
                    disabled={importing || selectedCount === 0}
                    className="flex items-center gap-1 rounded-md gradient-bg px-2.5 py-1 text-[10px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {importing ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-2.5 w-2.5" />
                    )}
                    Import {selectedCount}
                  </button>
                </div>
              </div>

              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {researchFindings.map(
                  (catResult, ci) =>
                    catResult.status === "ok" &&
                    catResult.findings.length > 0 && (
                      <div key={ci}>
                        <div className="px-4 py-2 bg-secondary/20 flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {catResult.category}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {catResult.findings.length} findings
                          </span>
                        </div>
                        {catResult.findings.map((finding, fi) => {
                          const key = `${ci}-${fi}`;
                          const isSelected = selectedFindings.has(key);
                          return (
                            <label
                              key={key}
                              className={cn(
                                "flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors",
                                isSelected
                                  ? "bg-primary/5"
                                  : "hover:bg-secondary/30"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const next = new Set(selectedFindings);
                                  if (e.target.checked) next.add(key);
                                  else next.delete(key);
                                  setSelectedFindings(next);
                                }}
                                className="mt-1 shrink-0 rounded border-border"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-xs font-medium">
                                    {finding.title}
                                  </span>
                                  <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                    {finding.area}
                                  </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground line-clamp-2">
                                  {finding.content}
                                </p>
                                {finding.sources?.length > 0 && (
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                    {finding.sources.map((url, si) => (
                                      <a
                                        key={si}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-[10px] text-primary hover:underline truncate max-w-[250px]"
                                      >
                                        {url
                                          .replace(/^https?:\/\/(www\.)?/, "")
                                          .split("/")[0]}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
