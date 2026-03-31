"use client";

import { cn } from "@/lib/utils";
import type { StepDefinition } from "@/lib/steps/definitions";
import type { StepState } from "@/lib/types";
import { Check, Loader2, Scale } from "lucide-react";

interface StepRailProps {
  stepDefs: StepDefinition[];
  steps: StepState[];
  activeStep: number;
  onSelectStep: (step: number) => void;
}

const statusIcon: Record<string, React.ReactNode> = {
  approved: <Check className="h-3 w-3 text-white" />,
  generating: <Loader2 className="h-3 w-3 text-white animate-spin" />,
};

const statusBg: Record<string, string> = {
  pending: "bg-muted-foreground/30",
  generating: "bg-amber-500",
  review: "bg-blue-500",
  approved: "bg-green-600",
  skipped: "bg-muted-foreground/20",
};

export function StepRail({
  stepDefs,
  steps,
  activeStep,
  onSelectStep,
}: StepRailProps) {
  return (
    <nav className="w-64 shrink-0 border-r border-border bg-sidebar overflow-y-auto">
      <div className="p-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
          Steps
        </h2>
        <div className="space-y-0.5">
          {stepDefs.map((def) => {
            const state = steps.find((s) => s.stepNumber === def.number);
            const status = state?.status ?? "pending";
            const isActive = activeStep === def.number;

            return (
              <button
                key={def.number}
                onClick={() => onSelectStep(def.number)}
                className={cn(
                  "w-full flex items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-secondary/60 text-foreground"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                    statusBg[status],
                    status === "approved" || status === "generating"
                      ? ""
                      : "text-foreground/70"
                  )}
                >
                  {statusIcon[status] ?? (
                    <span className="text-[10px]">{def.number}</span>
                  )}
                </div>

                <div className="min-w-0">
                  <div
                    className={cn(
                      "text-xs font-medium truncate",
                      status === "approved" &&
                        "text-green-700 dark:text-green-400"
                    )}
                  >
                    {def.shortTitle}
                  </div>
                  {def.dependsOn.length > 0 && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Needs: {def.dependsOn.join(", ")}
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {/* Final Decisions — always last */}
          <div className="mt-3 pt-3 border-t border-border">
            <button
              onClick={() => onSelectStep(-1)}
              className={cn(
                "w-full flex items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
                activeStep === -1
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-secondary/60 text-foreground"
              )}
            >
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20">
                <Scale className="h-3 w-3 text-primary" />
              </div>
              <div className="text-xs font-medium">Final Decisions</div>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
