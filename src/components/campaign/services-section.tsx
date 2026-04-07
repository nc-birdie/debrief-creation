"use client";

import Link from "next/link";
import {
  Compass,
  ArrowRight,
  Lock,
  Palette,
  BarChart3,
  Check,
  Loader2,
} from "lucide-react";
import type { StepState } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ServicesSectionProps {
  campaignId: string;
  campaignStatus: string;
  steps: StepState[];
  hasContext: boolean;
  onStartDebrief: () => void;
}

export function ServicesSection({
  campaignId,
  campaignStatus,
  steps,
  hasContext,
  onStartDebrief,
}: ServicesSectionProps) {
  const debriefStarted =
    campaignStatus === "in_progress" || campaignStatus === "completed";
  const approvedSteps = steps.filter((s) => s.status === "approved").length;
  const reviewSteps = steps.filter(
    (s) => s.status === "review" || s.status === "approved"
  ).length;
  const totalSteps = steps.length || 13;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Services</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Debrief / Direction Setting */}
        <div
          className={cn(
            "rounded-lg border bg-card p-5 flex flex-col transition-colors",
            hasContext
              ? "border-border hover:border-primary/30"
              : "border-border opacity-60"
          )}
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-bg shrink-0">
              <Compass className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Debrief Creation</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                13-step AI-powered direction setting workshop. Generates
                strategic deliverables from your program context.
              </p>
            </div>
          </div>

          {/* Progress indicator */}
          {debriefStarted && steps.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Progress</span>
                <span>
                  {reviewSteps} / {totalSteps} steps complete
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full gradient-bg transition-all duration-500"
                  style={{
                    width: `${(reviewSteps / totalSteps) * 100}%`,
                  }}
                />
              </div>
              {approvedSteps > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-green-600">
                  <Check className="h-2.5 w-2.5" />
                  {approvedSteps} approved
                </div>
              )}
            </div>
          )}

          <div className="mt-auto">
            {debriefStarted ? (
              <Link
                href={`/campaign/${campaignId}/workshop`}
                className="flex items-center justify-center gap-2 rounded-md gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity w-full"
              >
                Continue Workshop
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : hasContext ? (
              <button
                onClick={onStartDebrief}
                className="flex items-center justify-center gap-2 rounded-md gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity w-full"
              >
                Start Workshop
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground cursor-not-allowed w-full">
                Add context to get started
              </div>
            )}
          </div>
        </div>

        {/* Program Design — Coming Soon */}
        <div className="rounded-lg border border-border bg-card p-5 flex flex-col opacity-50">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary shrink-0">
              <Palette className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Program Design</h3>
                <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 text-[10px] font-medium">
                  Coming Soon
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Transform direction into a concrete program plan with channels,
                content, timeline, and budget allocation.
              </p>
            </div>
          </div>
          <div className="mt-auto">
            <div className="flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground cursor-not-allowed w-full">
              <Lock className="h-3.5 w-3.5" />
              Coming Soon
            </div>
          </div>
        </div>

        {/* Performance Analytics — Coming Soon */}
        <div className="rounded-lg border border-border bg-card p-5 flex flex-col opacity-50">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary shrink-0">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Performance Analytics</h3>
                <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 text-[10px] font-medium">
                  Coming Soon
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Track program performance, measure against KPIs, and generate
                insight reports.
              </p>
            </div>
          </div>
          <div className="mt-auto">
            <div className="flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground cursor-not-allowed w-full">
              <Lock className="h-3.5 w-3.5" />
              Coming Soon
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
