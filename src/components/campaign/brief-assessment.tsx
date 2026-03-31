"use client";

import { useState, useMemo } from "react";
import {
  ClipboardCheck,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Pencil,
  Check,
  X,
} from "lucide-react";
import type { BriefAssessment, CoverageStatus, CategoryAssessment } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BriefingTemplateCategory {
  id: string;
  label: string;
  enabled: boolean;
  questions: Array<{ id: string; question: string; enabled: boolean }>;
}

interface BriefAssessmentProps {
  campaignId: string;
  assessment: BriefAssessment | null;
  template: BriefingTemplateCategory[];
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<
  CoverageStatus,
  { icon: typeof CheckCircle2; label: string; color: string; bg: string }
> = {
  covered: {
    icon: CheckCircle2,
    label: "Covered",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-50/80 dark:bg-green-950/20",
  },
  partial: {
    icon: AlertTriangle,
    label: "Partial",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50/80 dark:bg-amber-950/20",
  },
  gap: {
    icon: XCircle,
    label: "Gap",
    color: "text-red-500 dark:text-red-400",
    bg: "bg-red-50/80 dark:bg-red-950/20",
  },
};

export function BriefAssessmentPanel({
  campaignId,
  assessment,
  template,
  onRefresh,
}: BriefAssessmentProps) {
  const [running, setRunning] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  );
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [editEvidence, setEditEvidence] = useState("");
  const [editStatus, setEditStatus] = useState<CoverageStatus>("partial");
  const [savingEdit, setSavingEdit] = useState(false);

  async function runAssessment() {
    setRunning(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/assess`, { method: "POST" });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
    setRunning(false);
  }

  function toggleCategory(catId: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  async function saveQuestionEdit(categoryId: string, questionId: string) {
    setSavingEdit(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/assess`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          questionId,
          evidence: editEvidence,
          status: editStatus,
        }),
      });
      setEditingQuestion(null);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
    setSavingEdit(false);
  }

  function startEditing(questionId: string, currentEvidence: string, currentStatus: CoverageStatus) {
    setEditingQuestion(questionId);
    setEditEvidence(currentEvidence);
    setEditStatus(currentStatus);
  }

  function expandAll() {
    setCollapsedCategories(new Set());
  }

  function collapseAll() {
    if (!assessment) return;
    setCollapsedCategories(
      new Set(assessment.categories.map((c) => c.categoryId))
    );
  }

  // Compute stats
  const stats = assessment
    ? (() => {
        let covered = 0;
        let partial = 0;
        let gap = 0;
        for (const cat of assessment.categories) {
          for (const q of cat.questions) {
            if (q.status === "covered") covered++;
            else if (q.status === "partial") partial++;
            else gap++;
          }
        }
        return { covered, partial, gap, total: covered + partial + gap };
      })()
    : null;

  // Build a lookup from template for question text
  const questionLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of template) {
      for (const q of cat.questions) {
        map.set(q.id, q.question);
      }
    }
    return map;
  }, [template]);

  // Build a lookup for category labels
  const categoryLabelLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of template) {
      map.set(cat.id, cat.label);
    }
    return map;
  }, [template]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          Brief Assessment Readiness
        </h3>
        <button
          onClick={runAssessment}
          disabled={running}
          className="flex items-center gap-1.5 rounded-md gradient-bg px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {running ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : assessment ? (
            <RefreshCw className="h-3 w-3" />
          ) : (
            <ClipboardCheck className="h-3 w-3" />
          )}
          {running
            ? "Assessing..."
            : assessment
              ? "Re-assess"
              : "Run Assessment"}
        </button>
      </div>

      {!assessment && !running && (
        <p className="text-xs text-muted-foreground">
          Run the assessment to see how your program context maps to the
          briefing framework. The AI will identify what's covered, partially
          covered, and where there are knowledge gaps.
        </p>
      )}

      {assessment && stats && (
        <>
          {/* Score overview */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall readiness</span>
              <span
                className={cn(
                  "text-lg font-bold",
                  assessment.overallScore >= 70
                    ? "text-green-600"
                    : assessment.overallScore >= 40
                      ? "text-amber-600"
                      : "text-red-500"
                )}
              >
                {assessment.overallScore}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  assessment.overallScore >= 70
                    ? "bg-green-500"
                    : assessment.overallScore >= 40
                      ? "bg-amber-500"
                      : "bg-red-500"
                )}
                style={{ width: `${assessment.overallScore}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-green-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {stats.covered} covered
                </span>
                <span className="flex items-center gap-1.5 text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {stats.partial} partial
                </span>
                <span className="flex items-center gap-1.5 text-red-500">
                  <XCircle className="h-3.5 w-3.5" />
                  {stats.gap} gaps
                </span>
              </div>
              <div className="flex gap-2 text-[10px]">
                <button
                  onClick={expandAll}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Expand all
                </button>
                <span className="text-muted-foreground/30">|</span>
                <button
                  onClick={collapseAll}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Collapse all
                </button>
              </div>
            </div>

            {assessment.summary && (
              <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">
                {assessment.summary}
              </p>
            )}
          </div>

          {/* Category details — iterate over assessment categories directly */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {assessment.categories.map((catAssessment) => {
              const catLabel =
                categoryLabelLookup.get(catAssessment.categoryId) ??
                catAssessment.categoryId;

              const catStats = {
                covered: catAssessment.questions.filter(
                  (q) => q.status === "covered"
                ).length,
                partial: catAssessment.questions.filter(
                  (q) => q.status === "partial"
                ).length,
                gap: catAssessment.questions.filter(
                  (q) => q.status === "gap"
                ).length,
              };

              const isCollapsed = collapsedCategories.has(
                catAssessment.categoryId
              );
              const worstStatus: CoverageStatus =
                catStats.gap > 0
                  ? "gap"
                  : catStats.partial > 0
                    ? "partial"
                    : "covered";
              const worstCfg = STATUS_CONFIG[worstStatus];

              return (
                <div
                  key={catAssessment.categoryId}
                  className="rounded-lg border border-border bg-card overflow-hidden flex flex-col"
                >
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(catAssessment.categoryId)}
                    className="flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {(() => {
                        const Icon = worstCfg.icon;
                        return (
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              worstCfg.color
                            )}
                          />
                        );
                      })()}
                      <span className="text-sm font-semibold truncate">
                        {catLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex gap-1">
                        {catStats.covered > 0 && (
                          <span className="rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 text-[10px] font-medium">
                            {catStats.covered}
                          </span>
                        )}
                        {catStats.partial > 0 && (
                          <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-medium">
                            {catStats.partial}
                          </span>
                        )}
                        {catStats.gap > 0 && (
                          <span className="rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 text-[10px] font-medium">
                            {catStats.gap}
                          </span>
                        )}
                      </div>
                      {isCollapsed ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Questions — shown by default */}
                  {!isCollapsed && (
                    <div className="border-t border-border divide-y divide-border">
                      {catAssessment.questions.map((qa) => {
                        const questionText =
                          questionLookup.get(qa.questionId) ??
                          qa.questionId;
                        const cfg = STATUS_CONFIG[qa.status];
                        const Icon = cfg.icon;
                        const isEditing = editingQuestion === qa.questionId;

                        return (
                          <div
                            key={qa.questionId}
                            className={cn("px-4 py-3", cfg.bg)}
                          >
                            {isEditing ? (
                              <div className="space-y-2.5">
                                <p className="text-xs font-medium leading-snug">
                                  {questionText}
                                </p>
                                <div className="flex gap-1.5">
                                  {(["covered", "partial", "gap"] as const).map((s) => {
                                    const sCfg = STATUS_CONFIG[s];
                                    return (
                                      <button
                                        key={s}
                                        onClick={() => setEditStatus(s)}
                                        className={cn(
                                          "flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
                                          editStatus === s
                                            ? `${sCfg.bg} ${sCfg.color} border-current`
                                            : "border-border text-muted-foreground hover:bg-secondary"
                                        )}
                                      >
                                        {sCfg.label}
                                      </button>
                                    );
                                  })}
                                </div>
                                <textarea
                                  value={editEvidence}
                                  onChange={(e) => setEditEvidence(e.target.value)}
                                  rows={3}
                                  className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                                  placeholder="Enter your answer or evidence..."
                                  autoFocus
                                />
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => saveQuestionEdit(catAssessment.categoryId, qa.questionId)}
                                    disabled={savingEdit}
                                    className="flex items-center gap-1 rounded-md gradient-bg px-2.5 py-1 text-[10px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                                  >
                                    {savingEdit ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />}
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingQuestion(null)}
                                    className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[10px] hover:bg-secondary"
                                  >
                                    <X className="h-2.5 w-2.5" />
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2.5 group">
                                <Icon
                                  className={cn(
                                    "h-3.5 w-3.5 shrink-0 mt-0.5",
                                    cfg.color
                                  )}
                                />
                                <div className="flex-1 min-w-0 space-y-1">
                                  <p className="text-xs font-medium leading-snug">
                                    {questionText}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    {qa.evidence}
                                  </p>
                                </div>
                                <button
                                  onClick={() => startEditing(qa.questionId, qa.evidence, qa.status)}
                                  className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-secondary text-muted-foreground transition-all"
                                  title="Edit answer"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
