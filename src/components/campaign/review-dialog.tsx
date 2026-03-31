"use client";

import { useState, useMemo } from "react";
import {
  X,
  AlertTriangle,
  HelpCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  SkipForward,
} from "lucide-react";
import type { KnowledgeGap, Decision } from "@/lib/types";
import { cn } from "@/lib/utils";

type ReviewItem =
  | { type: "gap"; data: KnowledgeGap }
  | { type: "decision"; data: Decision };

interface ReviewDialogProps {
  gaps: KnowledgeGap[];
  decisions: Decision[];
  initialIndex: number;
  initialType: "gap" | "decision";
  onResolveGap: (gapId: string, resolution: string) => void;
  onDismissGap: (gapId: string) => void;
  onDecide: (decisionId: string, chosen: string) => void;
  onClose: () => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  source_needed: "Source Needed",
  research_needed: "Research Needed",
  decision_needed: "Decision Needed",
};

const CATEGORY_CLASS: Record<string, string> = {
  source_needed: "gap-source",
  research_needed: "gap-research",
  decision_needed: "gap-decision",
};

export function ReviewDialog({
  gaps,
  decisions,
  initialIndex,
  initialType,
  onResolveGap,
  onDismissGap,
  onDecide,
  onClose,
}: ReviewDialogProps) {
  // Build ordered list: all gaps then all decisions
  const items = useMemo<ReviewItem[]>(() => {
    const list: ReviewItem[] = [
      ...gaps.map((g) => ({ type: "gap" as const, data: g })),
      ...decisions.map((d) => ({ type: "decision" as const, data: d })),
    ];
    return list;
  }, [gaps, decisions]);

  // Find starting index
  const startIdx = useMemo(() => {
    if (initialType === "gap") {
      return items.findIndex(
        (i) => i.type === "gap" && i.data.id === gaps[initialIndex]?.id
      );
    }
    const decIdx = items.findIndex(
      (i) =>
        i.type === "decision" && i.data.id === decisions[initialIndex]?.id
    );
    return decIdx >= 0 ? decIdx : 0;
  }, [items, initialType, initialIndex, gaps, decisions]);

  const [currentIdx, setCurrentIdx] = useState(Math.max(0, startIdx));
  const [resolution, setResolution] = useState("");
  const [customOption, setCustomOption] = useState("");

  const current = items[currentIdx];
  if (!current) return null;

  const unresolvedCount = items.filter((i) => {
    if (i.type === "gap") return !(i.data as KnowledgeGap).resolved;
    return !(i.data as Decision).chosen;
  }).length;

  function goNext() {
    if (currentIdx < items.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setResolution("");
      setCustomOption("");
    } else {
      onClose();
    }
  }

  function goPrev() {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
      setResolution("");
      setCustomOption("");
    }
  }

  function handleResolve() {
    if (current.type === "gap" && resolution.trim()) {
      onResolveGap(current.data.id, resolution.trim());
      setResolution("");
      // Auto-advance
      setTimeout(goNext, 150);
    }
  }

  function handleDecide(chosen: string) {
    if (current.type === "decision") {
      onDecide(current.data.id, chosen);
      setCustomOption("");
      setTimeout(goNext, 150);
    }
  }

  function handleDismiss() {
    if (current.type === "gap") {
      onDismissGap(current.data.id);
      setTimeout(goNext, 150);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg mx-4 rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            {current.type === "gap" ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <HelpCircle className="h-4 w-4 text-primary" />
            )}
            <span className="text-sm font-semibold">
              {current.type === "gap" ? "Knowledge Gap" : "Decision"}
            </span>
            <span className="text-xs text-muted-foreground">
              {currentIdx + 1} of {items.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground mr-2">
              {unresolvedCount} remaining
            </span>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-secondary rounded-md text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Progress dots */}
        <div className="px-5 pt-3 flex gap-1">
          {items.map((item, i) => {
            const isDone =
              item.type === "gap"
                ? (item.data as KnowledgeGap).resolved
                : !!(item.data as Decision).chosen;
            return (
              <button
                key={i}
                onClick={() => {
                  setCurrentIdx(i);
                  setResolution("");
                  setCustomOption("");
                }}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i === currentIdx
                    ? "bg-primary"
                    : isDone
                      ? "bg-primary/30"
                      : "bg-muted-foreground/20"
                )}
              />
            );
          })}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {current.type === "gap" ? (
            <GapContent
              gap={current.data as KnowledgeGap}
              resolution={resolution}
              onResolutionChange={setResolution}
              onResolve={handleResolve}
              onDismiss={handleDismiss}
            />
          ) : (
            <DecisionContent
              decision={current.data as Decision}
              customOption={customOption}
              onCustomOptionChange={setCustomOption}
              onDecide={handleDecide}
            />
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <button
            onClick={goPrev}
            disabled={currentIdx === 0}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
            Previous
          </button>
          <button
            onClick={goNext}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors"
          >
            {currentIdx === items.length - 1 ? (
              "Done"
            ) : (
              <>
                Skip
                <SkipForward className="h-3 w-3" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Gap content inside dialog ──

function GapContent({
  gap,
  resolution,
  onResolutionChange,
  onResolve,
  onDismiss,
}: {
  gap: KnowledgeGap;
  resolution: string;
  onResolutionChange: (v: string) => void;
  onResolve: () => void;
  onDismiss: () => void;
}) {
  if (gap.resolved) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold line-through opacity-60">
            {gap.title}
          </h3>
        </div>
        {gap.resolution && (
          <div className="rounded-md bg-accent/30 p-3">
            <p className="text-sm text-muted-foreground">{gap.resolution}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-medium",
            CATEGORY_CLASS[gap.category]
          )}
        >
          {CATEGORY_LABEL[gap.category] ?? gap.category}
        </span>
      </div>
      <h3 className="text-base font-semibold">{gap.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {gap.description}
      </p>
      <div className="space-y-2">
        <textarea
          value={resolution}
          onChange={(e) => onResolutionChange(e.target.value)}
          placeholder="Provide the missing information..."
          rows={4}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onResolve();
          }}
        />
        <div className="flex items-center justify-between">
          <button
            onClick={onDismiss}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Dismiss this gap
          </button>
          <button
            onClick={onResolve}
            disabled={!resolution.trim()}
            className="rounded-md gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Resolve
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Decision content inside dialog ──

function DecisionContent({
  decision,
  customOption,
  onCustomOptionChange,
  onDecide,
}: {
  decision: Decision;
  customOption: string;
  onCustomOptionChange: (v: string) => void;
  onDecide: (chosen: string) => void;
}) {
  if (decision.chosen) {
    const isDeferred = decision.chosen === "__DEFERRED__";
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {isDeferred ? (
            <SkipForward className="h-4 w-4 text-amber-500" />
          ) : (
            <Check className="h-4 w-4 text-primary" />
          )}
          <h3 className="text-base font-semibold">{decision.title}</h3>
        </div>
        <div className={cn("rounded-md p-3", isDeferred ? "bg-amber-50/50 dark:bg-amber-950/20" : "bg-accent/30")}>
          <p className="text-sm">
            {isDeferred ? (
              <span className="text-amber-600 dark:text-amber-400">Deferred to Final Decisions</span>
            ) : (
              <><span className="font-medium">Decided:</span> {decision.chosen}</>
            )}
          </p>
        </div>
        {isDeferred && (
          <button
            onClick={() => onDecide("")}
            className="text-xs text-primary hover:underline"
          >
            Decide now instead
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">{decision.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {decision.description}
      </p>

      {decision.recommendation && (
        <div className="rounded-md border border-primary/20 bg-accent/20 p-3">
          <p className="text-xs">
            <span className="font-semibold text-primary">AI recommends:</span>{" "}
            {decision.recommendation}
          </p>
          {decision.reasoning && (
            <p className="text-xs text-muted-foreground mt-1">
              {decision.reasoning}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Choose an option:
        </p>
        <div className="grid grid-cols-1 gap-2">
          {decision.options.map((opt) => (
            <button
              key={opt}
              onClick={() => onDecide(opt)}
              className={cn(
                "rounded-md border px-4 py-2.5 text-sm text-left font-medium transition-colors",
                opt === decision.recommendation
                  ? "border-primary/40 bg-primary/5 text-foreground hover:bg-primary/10"
                  : "border-border hover:bg-secondary"
              )}
            >
              {opt}
              {opt === decision.recommendation && (
                <span className="ml-2 text-[10px] text-primary font-normal">
                  recommended
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={customOption}
            onChange={(e) => onCustomOptionChange(e.target.value)}
            placeholder="Or type a custom answer..."
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={(e) => {
              if (e.key === "Enter" && customOption.trim())
                onDecide(customOption.trim());
            }}
          />
          <button
            onClick={() => {
              if (customOption.trim()) onDecide(customOption.trim());
            }}
            disabled={!customOption.trim()}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-30"
          >
            Choose
          </button>
        </div>
        <button
          onClick={() => onDecide("__DEFERRED__")}
          className="w-full rounded-md border border-dashed border-border px-4 py-2.5 text-xs text-muted-foreground hover:bg-secondary/50 transition-colors mt-1"
        >
          Not ready to decide yet — defer to Final Decisions
        </button>
      </div>
    </div>
  );
}
