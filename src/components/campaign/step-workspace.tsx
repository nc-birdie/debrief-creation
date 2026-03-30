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

  const hasGapsOrDecisions =
    stepState.knowledgeGaps.length > 0 || stepState.decisions.length > 0;

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

      {/* Main content: side-by-side when there are gaps/decisions */}
      {stepState.aiDraft && (
        <div
          className={cn(
            "gap-5",
            hasGapsOrDecisions ? "flex flex-col lg:flex-row" : ""
          )}
        >
          {/* AI Draft — left side */}
          <section
            className={cn(
              "rounded-lg border border-border bg-card",
              hasGapsOrDecisions ? "lg:flex-1 lg:min-w-0" : ""
            )}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                AI Draft
              </h3>
              {stepState.generatedAt && (
                <span className="text-[10px] text-muted-foreground">
                  {new Date(stepState.generatedAt).toLocaleString()}
                </span>
              )}
            </div>
            <div className="p-5">
              <StepDisplay content={stepState.aiDraft} displayType={outputDisplay} />
            </div>
          </section>

          {/* Gaps + Decisions — right side (compact clickable list) */}
          {hasGapsOrDecisions && (
            <aside className="lg:w-[300px] lg:shrink-0 space-y-4">
              {/* Knowledge Gaps */}
              {stepState.knowledgeGaps.length > 0 && (
                <section className="rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h3 className="text-xs font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      Knowledge Gaps
                    </h3>
                    <button
                      onClick={() => openReview("gap", 0)}
                      className="text-[10px] text-primary hover:underline"
                    >
                      Review all
                    </button>
                  </div>
                  <div className="divide-y divide-border">
                    {stepState.knowledgeGaps.map((gap, i) => (
                      <button
                        key={gap.id}
                        onClick={() => openReview("gap", i)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-secondary/30 transition-colors",
                          gap.resolved && "opacity-50"
                        )}
                      >
                        {gap.resolved ? (
                          <Check className="h-3 w-3 text-primary shrink-0" />
                        ) : (
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full shrink-0",
                              gap.category === "source_needed"
                                ? "bg-blue-500"
                                : gap.category === "research_needed"
                                  ? "bg-amber-500"
                                  : "bg-primary"
                            )}
                          />
                        )}
                        <span
                          className={cn(
                            "text-xs truncate",
                            gap.resolved
                              ? "line-through text-muted-foreground"
                              : "font-medium"
                          )}
                        >
                          {gap.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Decisions */}
              {stepState.decisions.length > 0 && (
                <section className="rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h3 className="text-xs font-semibold flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5 text-primary" />
                      Decisions
                    </h3>
                    <button
                      onClick={() => openReview("decision", 0)}
                      className="text-[10px] text-primary hover:underline"
                    >
                      Review all
                    </button>
                  </div>
                  <div className="divide-y divide-border">
                    {stepState.decisions.map((dec, i) => (
                      <button
                        key={dec.id}
                        onClick={() => openReview("decision", i)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-secondary/30 transition-colors"
                        )}
                      >
                        {dec.chosen ? (
                          <Check className="h-3 w-3 text-primary shrink-0" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-primary/40 shrink-0" />
                        )}
                        <span
                          className={cn(
                            "text-xs truncate",
                            dec.chosen ? "text-muted-foreground" : "font-medium"
                          )}
                        >
                          {dec.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </aside>
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
        </div>
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
          <div className="flex items-center gap-1.5 border-b border-primary/20 px-5 py-3">
            <Check className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-sm font-semibold text-primary">
              Approved Output
            </h3>
          </div>
          <div className="p-5">
            <StepDisplay content={stepState.finalOutput} displayType={outputDisplay} />
          </div>
        </section>
      )}
    </div>
  );
}

