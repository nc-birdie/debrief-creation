"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bird,
  Compass,
  Download,
  Loader2,
  Sparkles,
  Check,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import type { Campaign, StepState, KnowledgeEntry, KnowledgeGap, Decision } from "@/lib/types";
import type { StepDefinition } from "@/lib/steps/definitions";
import { StepRail } from "@/components/campaign/step-rail";
import { StepWorkspace } from "@/components/campaign/step-workspace";
import { ContextSidebar } from "@/components/campaign/context-sidebar";
import { FinalDecisions } from "@/components/campaign/final-decisions";
import { cn } from "@/lib/utils";

type ViewMode = "overview" | "step" | "final-decisions";

interface GapWithStep extends KnowledgeGap {
  stepNumber: number;
  stepTitle: string;
}

interface DecisionWithStep extends Decision {
  stepNumber: number;
  stepTitle: string;
}

export default function CampaignWorkspacePage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [steps, setSteps] = useState<StepState[]>([]);
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [stepDefs, setStepDefs] = useState<StepDefinition[]>([]);
  const [activeStep, setActiveStep] = useState(0); // 0 = overview
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Parallel generation state
  const [generating, setGenerating] = useState(false);
  const [generationDone, setGenerationDone] = useState(false);
  const [inputPhaseComplete, setInputPhaseComplete] = useState(false);
  const [refining, setRefining] = useState(false);
  const autoTriggered = useRef(false);

  // Inline gap resolution
  const [resolvingGapId, setResolvingGapId] = useState<string | null>(null);
  const [gapResolution, setGapResolution] = useState("");

  const fetchStepDefs = useCallback(async () => {
    const res = await fetch("/api/admin/steps");
    if (res.ok) setStepDefs(await res.json());
  }, []);

  const fetchCampaign = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaignId}`);
    if (res.ok) {
      const data = await res.json();
      setCampaign(data);
      setSteps(data.steps ?? []);
      setKnowledgeEntries(data.knowledgeEntries ?? []);
    }
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    fetchCampaign();
    fetchStepDefs();
  }, [fetchCampaign, fetchStepDefs]);

  // Auto-trigger generation when all steps are pending (or no step states yet)
  useEffect(() => {
    if (autoTriggered.current || loading || stepDefs.length === 0) return;
    const allPending = steps.length === 0 || steps.every((s) => s.status === "pending");
    const anyReview = steps.some((s) => s.status === "review" || s.status === "approved");
    if (allPending && !generating) {
      autoTriggered.current = true;
      triggerGenerateAll(false);
    } else if (anyReview) {
      autoTriggered.current = true;
      setGenerationDone(true);
    }
  }, [steps, loading, stepDefs]);

  // Poll for progress while generating
  useEffect(() => {
    if (!generating) return;
    const interval = setInterval(fetchCampaign, 3000);
    return () => clearInterval(interval);
  }, [generating, fetchCampaign]);

  // Check if generation is complete
  useEffect(() => {
    if (!generating) return;
    const enabledNums = new Set(stepDefs.filter((d) => d.enabled).map((d) => d.number));
    const relevantSteps = steps.filter((s) => enabledNums.has(s.stepNumber));
    const allDone = relevantSteps.length > 0 && relevantSteps.every(
      (s) => s.status === "review" || s.status === "approved" || s.status === "pending"
    );
    const noneGenerating = !relevantSteps.some((s) => s.status === "generating");
    if (allDone && noneGenerating && relevantSteps.some((s) => s.status === "review")) {
      setGenerating(false);
      setGenerationDone(true);
    }
  }, [steps, generating, stepDefs]);

  async function triggerGenerateAll(refine: boolean) {
    if (refine) setRefining(true);
    else setGenerating(true);
    setGenerationDone(false);
    try {
      await fetch(`/api/campaigns/${campaignId}/generate-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refine }),
      });
      await fetchCampaign();
    } catch (err) {
      console.error(err);
    }
    if (refine) {
      setRefining(false);
      setInputPhaseComplete(true);
    }
    setGenerating(false);
    setGenerationDone(true);
  }

  async function resolveGap(stepNumber: number, gapId: string, resolution: string) {
    await fetch(`/api/campaigns/${campaignId}/steps/${stepNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "resolve-gap", gapId, resolution }),
    });
    await fetchCampaign();
  }

  async function dismissGap(stepNumber: number, gapId: string) {
    await fetch(`/api/campaigns/${campaignId}/steps/${stepNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "dismiss-gap", gapId }),
    });
    await fetchCampaign();
  }

  async function makeDecision(stepNumber: number, decisionId: string, chosen: string) {
    await fetch(`/api/campaigns/${campaignId}/steps/${stepNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "decide", decisionId, chosen }),
    });
    await fetchCampaign();
  }

  const enabledStepDefs = stepDefs.filter((d) => d.enabled);

  // Aggregate all gaps and decisions across steps
  const allGaps: GapWithStep[] = [];
  const allDecisions: DecisionWithStep[] = [];
  for (const step of steps) {
    const def = enabledStepDefs.find((d) => d.number === step.stepNumber);
    if (!def) continue;
    for (const gap of step.knowledgeGaps) {
      allGaps.push({ ...gap, stepNumber: step.stepNumber, stepTitle: def.shortTitle });
    }
    for (const dec of step.decisions) {
      allDecisions.push({ ...dec, stepNumber: step.stepNumber, stepTitle: def.shortTitle });
    }
  }

  const unresolvedGaps = allGaps.filter((g) => !g.resolved);
  const unresolvedDecisions = allDecisions.filter((d) => !d.chosen);
  const deferredDecisions = allDecisions.filter((d) => d.chosen === "__DEFERRED__");

  // Current step for step view
  const currentStepDef = enabledStepDefs.find((d) => d.number === activeStep);
  const currentStepState = steps.find((s) => s.stepNumber === activeStep);

  const dependentOutputs = currentStepDef
    ? currentStepDef.dependsOn
        .map((depNum) => {
          const depStep = steps.find((s) => s.stepNumber === depNum);
          const depDef = stepDefs.find((d) => d.number === depNum);
          return depStep?.finalOutput
            ? { stepNumber: depNum, title: depDef?.shortTitle ?? `Step ${depNum}`, output: depStep.finalOutput }
            : null;
        })
        .filter(Boolean) as Array<{ stepNumber: number; title: string; output: string }>
    : [];

  // Progress stats
  const completedSteps = steps.filter((s) => s.status === "review" || s.status === "approved").length;
  const generatingSteps = steps.filter((s) => s.status === "generating").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        Campaign not found
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="glass shrink-0 px-4 py-3 z-50">
        <div className="flex items-center gap-3">
          <Link href={`/campaign/${campaignId}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div className="flex h-6 w-6 items-center justify-center rounded gradient-bg">
            <Compass className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm font-semibold">{campaign.name}</span>
          {generating && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              {generatingSteps} agents working... ({completedSteps}/{enabledStepDefs.length} done)
            </span>
          )}
          <div className="flex-1" />
          <button
            onClick={() => { setViewMode("overview"); setActiveStep(0); }}
            className={cn(
              "text-xs px-2 py-1 rounded hover:bg-secondary",
              viewMode === "overview" ? "text-primary font-medium" : "text-muted-foreground"
            )}
          >
            Overview
          </button>
          {generationDone && (
            <button
              onClick={() => router.push(`/campaign/${campaignId}/interactive`)}
              className="flex items-center gap-1.5 text-xs font-medium gradient-bg text-white px-3 py-1.5 rounded hover:opacity-90 transition-opacity"
            >
              <Bird className="h-3 w-3" />
              Interactive Review
            </button>
          )}
          <a
            href={`/api/campaigns/${campaignId}/export`}
            download
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary"
          >
            <Download className="h-3 w-3" />
            Steps
          </a>
          <a
            href={`/api/campaigns/${campaignId}/export?type=context`}
            download
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary"
          >
            <Download className="h-3 w-3" />
            Context
          </a>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary"
          >
            {sidebarOpen ? "Hide Context" : "Show Context"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Step Rail */}
        <StepRail
          stepDefs={enabledStepDefs}
          steps={steps}
          activeStep={activeStep}
          onSelectStep={(n) => {
            if (n === -1) {
              setViewMode("final-decisions");
              setActiveStep(-1);
            } else {
              setViewMode("step");
              setActiveStep(n);
            }
          }}
        />

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === "final-decisions" ? (
            <FinalDecisions
              campaignId={campaignId}
              steps={steps}
              stepDefs={enabledStepDefs}
              onRefresh={fetchCampaign}
            />
          ) : viewMode === "step" && currentStepDef && currentStepState ? (
            <StepWorkspace
              campaignId={campaignId}
              stepDef={currentStepDef}
              stepState={currentStepState}
              outputDisplay={currentStepDef.outputDisplay}
              onRefresh={() => fetchCampaign()}
            />
          ) : (
            /* Overview mode */
            <div className="p-6 space-y-6 max-w-4xl mx-auto">
              <div>
                <h2 className="text-xl font-bold mb-1">Direction Setting</h2>
                <p className="text-sm text-muted-foreground">
                  {generating
                    ? "AI agents are working on all steps simultaneously. This may take a few minutes."
                    : generationDone
                      ? "All drafts are ready. Review the knowledge gaps and decisions below, then refine."
                      : "Starting parallel generation..."}
                </p>
              </div>

              {/* Progress grid */}
              {(generating || generationDone) && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {enabledStepDefs.map((def) => {
                    const step = steps.find((s) => s.stepNumber === def.number);
                    const status = step?.status ?? "pending";
                    return (
                      <button
                        key={def.number}
                        onClick={() => {
                          if (status === "review" || status === "approved") {
                            setViewMode("step");
                            setActiveStep(def.number);
                          }
                        }}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-colors",
                          status === "review" || status === "approved"
                            ? "border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-950/20 hover:border-green-300 cursor-pointer"
                            : status === "generating"
                              ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20"
                              : "border-border bg-card"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {status === "generating" ? (
                            <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />
                          ) : status === "review" || status === "approved" ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <div className="h-3.5 w-3.5 rounded-full bg-muted-foreground/20" />
                          )}
                          <span className="text-xs font-medium truncate">{def.shortTitle}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground capitalize">{status}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Gaps & Decisions — shown when generation is complete */}
              {generationDone && !inputPhaseComplete && (
                <>
                  {/* Knowledge Gaps */}
                  {allGaps.length > 0 && (
                    <section className="rounded-lg border-2 border-amber-300/40 dark:border-amber-700/40 bg-card">
                      <div className="px-5 py-3 border-b border-amber-200/40 dark:border-amber-800/30">
                        <h3 className="text-sm font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          Knowledge Gaps
                          {unresolvedGaps.length > 0 && (
                            <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 text-[10px] font-medium">
                              {unresolvedGaps.length} open
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground font-normal ml-1">
                            across all steps
                          </span>
                        </h3>
                      </div>
                      <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                        {allGaps.map((gap) => (
                          <div key={`${gap.stepNumber}-${gap.id}`} className="px-5 py-3.5">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 shrink-0">
                                {gap.resolved ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className={cn("text-sm font-medium", gap.resolved && "text-muted-foreground line-through")}>
                                    {gap.title}
                                  </span>
                                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                    {gap.stepTitle}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">{gap.description}</p>
                                {gap.resolved && gap.resolution && (
                                  <p className="text-xs text-green-700 dark:text-green-400 mt-1.5 bg-green-50/50 dark:bg-green-950/20 rounded-md px-2.5 py-1.5">
                                    {gap.resolution}
                                  </p>
                                )}
                                {!gap.resolved && resolvingGapId === `${gap.stepNumber}-${gap.id}` ? (
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
                                            resolveGap(gap.stepNumber, gap.id, gapResolution.trim());
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
                                        onClick={() => { dismissGap(gap.stepNumber, gap.id); setResolvingGapId(null); }}
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
                                    onClick={() => { setResolvingGapId(`${gap.stepNumber}-${gap.id}`); setGapResolution(""); }}
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

                  {/* Decisions */}
                  {allDecisions.length > 0 && (
                    <section className="rounded-lg border-2 border-primary/30 bg-card">
                      <div className="px-5 py-3 border-b border-primary/20">
                        <h3 className="text-sm font-semibold flex items-center gap-1.5">
                          <HelpCircle className="h-4 w-4 text-primary" />
                          Decisions Required
                          {unresolvedDecisions.length > 0 && (
                            <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
                              {unresolvedDecisions.length} pending
                            </span>
                          )}
                          {deferredDecisions.length > 0 && (
                            <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 text-[10px] font-medium">
                              {deferredDecisions.length} deferred
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground font-normal ml-1">
                            across all steps
                          </span>
                        </h3>
                      </div>
                      <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                        {allDecisions.map((dec) => {
                          const isDeferred = dec.chosen === "__DEFERRED__";
                          return (
                            <div key={`${dec.stepNumber}-${dec.id}`} className="px-5 py-3.5">
                              <div className="flex items-start gap-3">
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
                                    <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                      {dec.stepTitle}
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
                                  <p className="text-xs text-muted-foreground">{dec.description}</p>
                                  {!dec.chosen && dec.recommendation && (
                                    <p className="text-xs mt-1">
                                      <span className="font-semibold text-primary">Rec:</span> {dec.recommendation}
                                    </p>
                                  )}
                                  {!dec.chosen && dec.options.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      {dec.options.map((opt) => (
                                        <button
                                          key={opt}
                                          onClick={() => makeDecision(dec.stepNumber, dec.id, opt)}
                                          className={cn(
                                            "rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors",
                                            opt === dec.recommendation
                                              ? "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
                                              : "border-border hover:bg-secondary"
                                          )}
                                        >
                                          {opt}
                                        </button>
                                      ))}
                                      <button
                                        onClick={() => makeDecision(dec.stepNumber, dec.id, "__DEFERRED__")}
                                        className="rounded-md border border-dashed border-border px-2.5 py-1 text-[10px] text-muted-foreground hover:bg-secondary/50"
                                      >
                                        Not ready yet
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* Re-run all button */}
                  {(allGaps.length > 0 || allDecisions.length > 0) && (
                    <button
                      onClick={() => triggerGenerateAll(true)}
                      disabled={refining}
                      className="w-full flex items-center justify-center gap-2 rounded-md gradient-bg px-5 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {refining ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Refining all drafts...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          I&apos;ve given my input. Re-run all steps
                        </>
                      )}
                    </button>
                  )}
                </>
              )}

              {/* After refinement — collapsed summary + view individual steps */}
              {inputPhaseComplete && (
                <>
                  <section className="rounded-lg border border-border bg-card">
                    <button
                      onClick={() => setInputPhaseComplete(false)}
                      className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5 text-green-600" />
                          {allGaps.length} gaps, {allDecisions.length} decisions — input incorporated
                        </span>
                      </div>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </section>

                  <div className="rounded-lg border border-green-200 bg-green-50/30 dark:border-green-900/30 dark:bg-green-950/10 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="h-5 w-5 text-green-600" />
                      <h3 className="text-sm font-semibold text-green-700 dark:text-green-400">
                        Drafts refined with your input
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      Click any step in the sidebar to review the updated draft, approve it, or make further edits.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {enabledStepDefs.map((def) => (
                        <button
                          key={def.number}
                          onClick={() => { setViewMode("step"); setActiveStep(def.number); }}
                          className="rounded-lg border border-border bg-card p-3 text-left hover:border-primary/30 transition-colors"
                        >
                          <span className="text-xs font-medium">{def.shortTitle}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Context Sidebar */}
        {sidebarOpen && (
          <ContextSidebar
            campaignId={campaignId}
            knowledgeEntries={knowledgeEntries}
            dependentOutputs={dependentOutputs}
            onRefresh={fetchCampaign}
          />
        )}
      </div>
    </div>
  );
}
