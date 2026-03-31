"use client";

import { useState } from "react";
import { Scale, Check, AlertTriangle, HelpCircle } from "lucide-react";
import type { StepState, Decision } from "@/lib/types";
import type { StepDefinition } from "@/lib/steps/definitions";
import { cn } from "@/lib/utils";

interface DecisionWithContext extends Decision {
  stepNumber: number;
  stepTitle: string;
}

interface FinalDecisionsProps {
  campaignId: string;
  steps: StepState[];
  stepDefs: StepDefinition[];
  onRefresh: () => void;
}

export function FinalDecisions({
  campaignId,
  steps,
  stepDefs,
  onRefresh,
}: FinalDecisionsProps) {
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});

  // Collect all decisions across all steps
  const allDecisions: DecisionWithContext[] = [];
  for (const step of steps) {
    const def = stepDefs.find((d) => d.number === step.stepNumber);
    for (const dec of step.decisions) {
      allDecisions.push({
        ...dec,
        stepNumber: step.stepNumber,
        stepTitle: def?.shortTitle ?? `Step ${step.stepNumber}`,
      });
    }
  }

  const deferred = allDecisions.filter((d) => d.chosen === "__DEFERRED__");
  const undecided = allDecisions.filter((d) => !d.chosen);
  const decided = allDecisions.filter((d) => d.chosen && d.chosen !== "__DEFERRED__");

  const pending = [...deferred, ...undecided];

  async function makeDecision(dec: DecisionWithContext, chosen: string) {
    await fetch(`/api/campaigns/${campaignId}/steps/${dec.stepNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "decide", decisionId: dec.id, chosen }),
    });
    setCustomInputs((prev) => {
      const next = { ...prev };
      delete next[dec.id];
      return next;
    });
    onRefresh();
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Scale className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Final Decisions</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          All decisions across every step in one place. Resolve any deferred or outstanding decisions before completing the direction setting.
        </p>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span className="flex items-center gap-1.5 text-green-600">
          <Check className="h-4 w-4" />
          {decided.length} decided
        </span>
        {pending.length > 0 && (
          <span className="flex items-center gap-1.5 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            {pending.length} pending
          </span>
        )}
      </div>

      {/* Pending decisions */}
      {pending.length > 0 && (
        <section className="rounded-lg border-2 border-primary/30 bg-card">
          <div className="px-5 py-3 border-b border-primary/20">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-primary" />
              Pending Decisions
              <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
                {pending.length}
              </span>
            </h3>
          </div>
          <div className="divide-y divide-border">
            {pending.map((dec) => (
              <div key={`${dec.stepNumber}-${dec.id}`} className="px-5 py-4 space-y-3">
                <div>
                  <span className="text-[10px] text-muted-foreground">
                    Step {dec.stepNumber}: {dec.stepTitle}
                  </span>
                  <h4 className="text-sm font-semibold mt-0.5">{dec.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{dec.description}</p>
                </div>

                {dec.recommendation && (
                  <div className="rounded-md border border-primary/20 bg-accent/20 p-3">
                    <p className="text-xs">
                      <span className="font-semibold text-primary">AI recommends:</span>{" "}
                      {dec.recommendation}
                    </p>
                    {dec.reasoning && (
                      <p className="text-xs text-muted-foreground mt-1">{dec.reasoning}</p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {dec.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => makeDecision(dec, opt)}
                      className={cn(
                        "rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                        opt === dec.recommendation
                          ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                          : "border-border hover:bg-secondary"
                      )}
                    >
                      {opt}
                      {opt === dec.recommendation && (
                        <span className="ml-1.5 text-[10px] text-primary font-normal">rec.</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customInputs[dec.id] ?? ""}
                    onChange={(e) => setCustomInputs((prev) => ({ ...prev, [dec.id]: e.target.value }))}
                    placeholder="Or type a custom answer..."
                    className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customInputs[dec.id]?.trim()) {
                        makeDecision(dec, customInputs[dec.id].trim());
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (customInputs[dec.id]?.trim()) {
                        makeDecision(dec, customInputs[dec.id].trim());
                      }
                    }}
                    disabled={!customInputs[dec.id]?.trim()}
                    className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-secondary disabled:opacity-30"
                  >
                    Choose
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Decided */}
      {decided.length > 0 && (
        <section className="rounded-lg border border-border bg-card">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Check className="h-4 w-4 text-green-600" />
              Decided
              <span className="rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 text-[10px] font-medium">
                {decided.length}
              </span>
            </h3>
          </div>
          <div className="divide-y divide-border">
            {decided.map((dec) => (
              <div key={`${dec.stepNumber}-${dec.id}`} className="flex items-start gap-3 px-5 py-3.5">
                <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-muted-foreground">
                    Step {dec.stepNumber}: {dec.stepTitle}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm font-medium">{dec.title}</span>
                    <span className="rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 text-[10px] font-medium">
                      {dec.chosen}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {allDecisions.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No decisions have been generated yet. Complete the direction setting steps first.
        </div>
      )}
    </div>
  );
}
