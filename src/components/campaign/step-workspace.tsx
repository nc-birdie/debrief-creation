"use client";

import { useState, useRef } from "react";
import {
  Sparkles,
  Loader2,
  Check,
  AlertTriangle,
  HelpCircle,
  X,
  MessageSquare,
  Upload,
  Link as LinkIcon,
  Paperclip,
  Send,
  Download,
  ChevronDown,
} from "lucide-react";
import type { StepState } from "@/lib/types";
import type { StepDefinition } from "@/lib/steps/definitions";
import { cn } from "@/lib/utils";
import { StepDisplay } from "./step-display";
import { ReviewDialog } from "./review-dialog";

interface StepWorkspaceProps {
  campaignId: string;
  stepDef: StepDefinition;
  stepState: StepState;
  outputDisplay: string;
  onRefresh: () => void;
}

export function StepWorkspace({
  campaignId,
  stepDef,
  stepState,
  outputDisplay,
  onRefresh,
}: StepWorkspaceProps) {
  const [generating, setGenerating] = useState(false);
  const [userEdits, setUserEdits] = useState(stepState.userEdits ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previousDraft, setPreviousDraft] = useState<string | null>(null);

  // Generation input state
  const [genInput, setGenInput] = useState("");
  const [genFiles, setGenFiles] = useState<File[]>([]);
  const [genUrl, setGenUrl] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const genFileRef = useRef<HTMLInputElement>(null);

  // Review dialog state
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewInitialIndex, setReviewInitialIndex] = useState(0);
  const [reviewInitialType, setReviewInitialType] = useState<"gap" | "decision">("gap");

  function openReview(type: "gap" | "decision", index: number) {
    setReviewInitialType(type);
    setReviewInitialIndex(index);
    setReviewOpen(true);
  }

  async function handleGenerate() {
    // Save current draft for diff highlighting
    if (stepState.aiDraft) {
      setPreviousDraft(stepState.aiDraft);
    }
    setGenerating(true);
    try {
      // 1. Upload any attached files as sources + ingest them
      if (genFiles.length > 0) {
        const formData = new FormData();
        for (const f of genFiles) formData.append("files", f);
        const uploadRes = await fetch(
          `/api/campaigns/${campaignId}/sources`,
          { method: "POST", body: formData }
        );
        if (uploadRes.ok) {
          // Ingest newly uploaded sources
          await fetch(`/api/campaigns/${campaignId}/ingest`, {
            method: "POST",
          });
        }
      }

      // 2. If a URL was provided, fetch and add as context
      let urlContent = "";
      if (genUrl.trim()) {
        try {
          const res = await fetch(
            `/api/campaigns/${campaignId}/fetch-url`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: genUrl.trim() }),
            }
          );
          if (res.ok) {
            const data = await res.json();
            urlContent = data.content ?? "";
          }
        } catch {
          // URL fetch failed, continue without it
        }
      }

      // 3. Build additional context
      const parts = [];
      if (genInput.trim()) parts.push(genInput.trim());
      if (urlContent)
        parts.push(`Content from ${genUrl}:\n${urlContent}`);
      const additionalContext = parts.join("\n\n");

      // 4. Generate
      await fetch(
        `/api/campaigns/${campaignId}/steps/${stepDef.number}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ additionalContext }),
        }
      );

      // Reset inputs
      setGenInput("");
      setGenFiles([]);
      setGenUrl("");
      setShowUrlInput(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
    setGenerating(false);
  }

  async function handleApprove() {
    await fetch(`/api/campaigns/${campaignId}/steps/${stepDef.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "approve" }),
    });

    // Create a knowledge entry with the approved output
    const finalContent = stepState.aiDraft || "";
    if (finalContent) {
      await fetch(`/api/campaigns/${campaignId}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area: `debrief_${stepDef.shortTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`,
          title: `Debrief - ${stepDef.shortTitle}`,
          content: finalContent,
        }),
      });
    }

    setPreviousDraft(null);
    onRefresh();
  }

  async function saveEdits() {
    setSaving(true);
    await fetch(`/api/campaigns/${campaignId}/steps/${stepDef.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "user-edit", content: userEdits }),
    });
    setSaving(false);
    setEditing(false);
    onRefresh();
  }

  async function resolveGap(gapId: string, resolution: string) {
    await fetch(`/api/campaigns/${campaignId}/steps/${stepDef.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "resolve-gap", gapId, resolution }),
    });
    onRefresh();
  }

  async function dismissGap(gapId: string) {
    await fetch(`/api/campaigns/${campaignId}/steps/${stepDef.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "dismiss-gap", gapId }),
    });
    onRefresh();
  }

  async function makeDecision(decisionId: string, chosen: string) {
    await fetch(`/api/campaigns/${campaignId}/steps/${stepDef.number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "decide", decisionId, chosen }),
    });
    onRefresh();
  }

  const statusLabel: Record<string, string> = {
    pending: "Not started",
    generating: "Generating...",
    review: "Ready for review",
    approved: "Approved",
    skipped: "Skipped",
  };

  const statusColor: Record<string, string> = {
    pending: "text-muted-foreground",
    generating: "text-amber-600",
    review: "text-primary",
    approved: "text-primary",
    skipped: "text-muted-foreground",
  };

  const hasDecisions = stepState.decisions.length > 0;
  const unresolvedDecisions = stepState.decisions.filter((d) => !d.chosen).length;
  const deferredDecisions = stepState.decisions.filter((d) => d.chosen === "__DEFERRED__").length;
  const hasGaps = stepState.knowledgeGaps.length > 0;
  const unresolvedGaps = stepState.knowledgeGaps.filter((g) => !g.resolved).length;

  // Inline gap resolution state
  const [resolvingGapId, setResolvingGapId] = useState<string | null>(null);
  const [gapResolution, setGapResolution] = useState("");
  const [inputPhaseComplete, setInputPhaseComplete] = useState(false);

  /** Refine the existing draft using gap resolutions + decisions (not a full re-run) */
  async function handleRefine() {
    if (stepState.aiDraft) {
      setPreviousDraft(stepState.aiDraft);
    }
    setGenerating(true);
    try {
      await fetch(
        `/api/campaigns/${campaignId}/steps/${stepDef.number}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refine: true }),
        }
      );
      onRefresh();
    } catch (err) {
      console.error(err);
    }
    setGenerating(false);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Step header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-muted-foreground">
            Step {stepDef.number}
          </span>
          <span className={cn("text-xs", statusColor[stepState.status])}>
            {statusLabel[stepState.status]}
          </span>
        </div>
        <h2 className="text-xl font-bold mb-2">{stepDef.title}</h2>
        <p className="text-sm text-muted-foreground">{stepDef.description}</p>
      </div>

      {/* Generation panel */}
      {(stepState.status === "pending" || stepState.status === "review") && (
        <div className="rounded-lg border border-border bg-card">
          {/* Text input */}
          <div className="p-3">
            <textarea
              value={genInput}
              onChange={(e) => setGenInput(e.target.value)}
              rows={2}
              placeholder={
                stepState.status === "review"
                  ? "Add context, instructions, or corrections for regeneration..."
                  : "Optional: add specific instructions or context for this step..."
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  handleGenerate();
                }
              }}
            />
          </div>

          {/* URL input (expandable) */}
          {showUrlInput && (
            <div className="px-3 pb-3">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  type="url"
                  value={genUrl}
                  onChange={(e) => setGenUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  autoFocus
                />
                <button
                  onClick={() => {
                    setShowUrlInput(false);
                    setGenUrl("");
                  }}
                  className="p-1 hover:bg-secondary rounded text-muted-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Attached files */}
          {genFiles.length > 0 && (
            <div className="px-3 pb-3 flex flex-wrap gap-1.5">
              {genFiles.map((f, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[10px]"
                >
                  <Paperclip className="h-2.5 w-2.5" />
                  {f.name}
                  <button
                    onClick={() =>
                      setGenFiles((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="hover:text-destructive"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Bottom bar: attachment buttons + generate */}
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <div className="flex items-center gap-1">
              <input
                ref={genFileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    setGenFiles((prev) => [
                      ...prev,
                      ...Array.from(e.target.files!),
                    ]);
                  }
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => genFileRef.current?.click()}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                title="Attach files"
              >
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">File</span>
              </button>
              <button
                onClick={() => setShowUrlInput(true)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors",
                  showUrlInput && "bg-secondary text-foreground"
                )}
                title="Add URL"
              >
                <LinkIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">URL</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {stepState.status === "review" && (
                <button
                  onClick={handleApprove}
                  className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                >
                  <Check className="h-3 w-3" />
                  Approve
                </button>
              )}
              {(() => {
                const hasNewInput =
                  genInput.trim().length > 0 ||
                  genFiles.length > 0 ||
                  genUrl.trim().length > 0;
                const isRegen = stepState.status === "review";
                const disabled = generating || (isRegen && !hasNewInput);

                return (
                  <button
                    onClick={handleGenerate}
                    disabled={disabled}
                    className="flex items-center gap-1.5 rounded-md gradient-bg px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {generating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    {generating
                      ? "Generating..."
                      : isRegen
                        ? "Regenerate"
                        : "Generate"}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Knowledge Gaps + Decisions + Re-run — collapsed after refinement */}
      {(hasGaps || hasDecisions) && stepState.aiDraft && (
        inputPhaseComplete ? (
          /* Collapsed summary */
          <section className="rounded-lg border border-border bg-card">
            <button
              onClick={() => setInputPhaseComplete(false)}
              className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-green-600" />
                  {stepState.knowledgeGaps.length} gaps
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-green-600" />
                  {stepState.decisions.length} decisions
                </span>
                <span>— input incorporated into draft</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </section>
        ) : (
          <>
            {/* Knowledge Gaps */}
            {hasGaps && (
              <section className="rounded-lg border-2 border-amber-300/40 dark:border-amber-700/40 bg-card">
                <div className="flex items-center justify-between px-5 py-3 border-b border-amber-200/40 dark:border-amber-800/30">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Knowledge Gaps
                    {unresolvedGaps > 0 && (
                      <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 text-[10px] font-medium">
                        {unresolvedGaps} open
                      </span>
                    )}
                  </h3>
                  <button
                    onClick={() => openReview("gap", 0)}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    Review all
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {stepState.knowledgeGaps.map((gap) => (
                    <div key={gap.id} className="px-5 py-3.5">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          {gap.resolved ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={cn("text-sm font-medium", gap.resolved && "text-muted-foreground line-through")}>
                            {gap.title}
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5">{gap.description}</p>
                          {gap.resolved && gap.resolution && (
                            <p className="text-xs text-green-700 dark:text-green-400 mt-1.5 bg-green-50/50 dark:bg-green-950/20 rounded-md px-2.5 py-1.5">
                              {gap.resolution}
                            </p>
                          )}
                          {!gap.resolved && resolvingGapId === gap.id ? (
                            <div className="mt-2 space-y-2">
                              <textarea
                                value={gapResolution}
                                onChange={(e) => setGapResolution(e.target.value)}
                                rows={2}
                                placeholder="Enter what you know about this..."
                                className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                                autoFocus
                              />
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => {
                                    if (gapResolution.trim()) {
                                      resolveGap(gap.id, gapResolution.trim());
                                      setResolvingGapId(null);
                                      setGapResolution("");
                                    }
                                  }}
                                  disabled={!gapResolution.trim()}
                                  className="flex items-center gap-1 rounded-md gradient-bg px-2.5 py-1 text-[10px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                                >
                                  <Check className="h-2.5 w-2.5" />
                                  Resolve
                                </button>
                                <button
                                  onClick={() => {
                                    dismissGap(gap.id);
                                    setResolvingGapId(null);
                                    setGapResolution("");
                                  }}
                                  className="rounded-md border border-border px-2.5 py-1 text-[10px] text-muted-foreground hover:bg-secondary"
                                >
                                  Dismiss
                                </button>
                                <button
                                  onClick={() => { setResolvingGapId(null); setGapResolution(""); }}
                                  className="rounded-md border border-border px-2.5 py-1 text-[10px] text-muted-foreground hover:bg-secondary"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : !gap.resolved ? (
                            <button
                              onClick={() => { setResolvingGapId(gap.id); setGapResolution(""); }}
                              className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-400 hover:underline"
                            >
                              Respond to this gap
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Decisions Required */}
            {hasDecisions && (
              <section className="rounded-lg border-2 border-primary/30 bg-card">
                <div className="flex items-center justify-between px-5 py-3 border-b border-primary/20">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <HelpCircle className="h-4 w-4 text-primary" />
                    Decisions Required
                    {unresolvedDecisions > 0 && (
                      <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
                        {unresolvedDecisions} pending
                      </span>
                    )}
                    {deferredDecisions > 0 && (
                      <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 text-[10px] font-medium">
                        {deferredDecisions} deferred
                      </span>
                    )}
                  </h3>
                  <button
                    onClick={() => openReview("decision", 0)}
                    className="text-xs text-primary hover:underline"
                  >
                    Review all
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {stepState.decisions.map((dec, i) => {
                    const isDeferred = dec.chosen === "__DEFERRED__";
                    return (
                      <button
                        key={dec.id}
                        onClick={() => openReview("decision", i)}
                        className="w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-secondary/30 transition-colors"
                      >
                        <div className="mt-0.5 shrink-0">
                          {isDeferred ? (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          ) : dec.chosen ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-primary/40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={cn("text-sm font-medium", (dec.chosen && !isDeferred) && "text-muted-foreground")}>
                              {dec.title}
                            </span>
                            {isDeferred ? (
                              <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 text-[10px] font-medium">
                                Deferred
                              </span>
                            ) : dec.chosen ? (
                              <span className="rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 text-[10px] font-medium">
                                {dec.chosen}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">{dec.description}</p>
                          {!dec.chosen && dec.options.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {dec.options.map((opt) => (
                                <span key={opt} className="rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                                  {opt}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Re-run button — below both gaps and decisions */}
            <button
              onClick={async () => {
                await handleRefine();
                setInputPhaseComplete(true);
              }}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 rounded-md gradient-bg px-5 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Refining draft...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  I&apos;ve given my input. Re-run the step
                </>
              )}
            </button>
          </>
        )
      )}

      {/* AI Draft — full width, with diff highlighting */}
      {stepState.aiDraft && (
        <section className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              AI Draft
            </h3>
            <div className="flex items-center gap-3">
              {previousDraft && (
                <button
                  onClick={() => setPreviousDraft(null)}
                  className="text-[10px] text-primary hover:underline"
                >
                  Clear highlights
                </button>
              )}
              {stepState.generatedAt && (
                <span className="text-[10px] text-muted-foreground">
                  {new Date(stepState.generatedAt).toLocaleString()}
                </span>
              )}
            </div>
          </div>
          <div className="p-5">
            {previousDraft ? (
              <DiffDisplay
                oldText={previousDraft}
                newText={stepState.aiDraft}
                displayType={outputDisplay}
              />
            ) : (
              <StepDisplay content={stepState.aiDraft} displayType={outputDisplay} />
            )}
          </div>
        </section>
      )}

      {/* Review Dialog */}
      {reviewOpen && (
        <ReviewDialog
          gaps={stepState.knowledgeGaps}
          decisions={stepState.decisions}
          initialIndex={reviewInitialIndex}
          initialType={reviewInitialType}
          onResolveGap={(gapId, resolution) => {
            resolveGap(gapId, resolution);
          }}
          onDismissGap={(gapId) => {
            dismissGap(gapId);
          }}
          onDecide={(decisionId, chosen) => {
            makeDecision(decisionId, chosen);
          }}
          onClose={() => setReviewOpen(false)}
        />
      )}

      {/* User notes */}
      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-xs font-semibold flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Your Notes & Edits
          </h3>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-primary hover:underline"
            >
              Edit
            </button>
          )}
        </div>
        {editing ? (
          <div className="p-4 space-y-3">
            <textarea
              value={userEdits}
              onChange={(e) => setUserEdits(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              placeholder="Add your notes, corrections, or additional context..."
            />
            <div className="flex gap-2">
              <button
                onClick={saveEdits}
                disabled={saving}
                className="rounded-md gradient-bg px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setUserEdits(stepState.userEdits ?? "");
                }}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">
            {stepState.userEdits || (
              <span className="italic">
                No notes yet. Click Edit to add your input.
              </span>
            )}
          </div>
        )}
      </section>

      {/* Approved output */}
      {stepState.status === "approved" && stepState.finalOutput && (
        <section className="rounded-lg border-2 border-primary/20 bg-accent/20">
          <div className="flex items-center justify-between border-b border-primary/20 px-5 py-3">
            <div className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-sm font-semibold text-primary">
                Approved Output
              </h3>
            </div>
            <a
              href={`/api/campaigns/${campaignId}/export?step=${stepDef.number}`}
              download
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Download className="h-3 w-3" />
              Export
            </a>
          </div>
          <div className="p-5">
            <StepDisplay content={stepState.finalOutput} displayType={outputDisplay} />
          </div>
        </section>
      )}
    </div>
  );
}

// ── Diff Display ──

/**
 * Renders the new AI draft with changed/added paragraphs highlighted.
 * Uses a simple paragraph-level diff: splits both texts by double-newline,
 * compares each paragraph, and marks new or modified ones.
 */
function DiffDisplay({
  oldText,
  newText,
  displayType,
}: {
  oldText: string;
  newText: string;
  displayType: string;
}) {
  const oldParagraphs = new Set(
    oldText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  );

  const newParagraphs = newText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  // Determine which paragraphs are new or changed
  const diffMap = new Set<number>();
  for (let i = 0; i < newParagraphs.length; i++) {
    if (!oldParagraphs.has(newParagraphs[i])) {
      diffMap.add(i);
    }
  }

  // If nothing changed or everything changed, fall back to normal display
  if (diffMap.size === 0 || diffMap.size === newParagraphs.length) {
    return (
      <div>
        {diffMap.size === 0 && (
          <p className="text-xs text-muted-foreground italic mb-3">No changes detected in this re-run.</p>
        )}
        <StepDisplay content={newText} displayType={displayType} />
      </div>
    );
  }

  // Render paragraphs with highlights on changed ones
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-primary mb-3 flex items-center gap-1.5">
        <span className="inline-block w-2 h-2 rounded-full bg-primary" />
        Highlighted text is new or changed since the previous draft
      </p>
      {newParagraphs.map((para, i) => {
        const isChanged = diffMap.has(i);
        return (
          <div
            key={i}
            className={
              isChanged
                ? "border-l-2 border-primary pl-3 bg-primary/5 rounded-r-md py-1"
                : ""
            }
          >
            <StepDisplay content={para} displayType="prose" />
          </div>
        );
      })}
    </div>
  );
}

