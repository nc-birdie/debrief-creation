"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import type { Campaign, StepState, KnowledgeEntry } from "@/lib/types";
import type { StepDefinition } from "@/lib/steps/definitions";
import { StepRail } from "@/components/campaign/step-rail";
import { StepWorkspace } from "@/components/campaign/step-workspace";
import { ContextSidebar } from "@/components/campaign/context-sidebar";

export default function CampaignWorkspacePage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = use(params);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [steps, setSteps] = useState<StepState[]>([]);
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>(
    []
  );
  const [stepDefs, setStepDefs] = useState<StepDefinition[]>([]);
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
      if (data.currentStep) setActiveStep(data.currentStep);
    }
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    fetchCampaign();
    fetchStepDefs();
  }, [fetchCampaign, fetchStepDefs]);

  const refreshStep = useCallback(
    async (stepNumber: number) => {
      const res = await fetch(
        `/api/campaigns/${campaignId}/steps/${stepNumber}`
      );
      if (res.ok) {
        const updated = await res.json();
        setSteps((prev) =>
          prev.map((s) => (s.stepNumber === stepNumber ? updated : s))
        );
      }
    },
    [campaignId]
  );

  const currentStepDef = stepDefs.find(
    (d) => d.number === activeStep && d.enabled
  );
  const currentStepState = steps.find((s) => s.stepNumber === activeStep);
  const enabledStepDefs = stepDefs.filter((d) => d.enabled);

  // Get dependent step outputs for context sidebar
  const dependentOutputs = currentStepDef
    ? currentStepDef.dependsOn
        .map((depNum) => {
          const depStep = steps.find((s) => s.stepNumber === depNum);
          const depDef = stepDefs.find((d) => d.number === depNum);
          return depStep?.finalOutput
            ? {
                stepNumber: depNum,
                title: depDef?.shortTitle ?? `Step ${depNum}`,
                output: depStep.finalOutput,
              }
            : null;
        })
        .filter(Boolean) as Array<{
        stepNumber: number;
        title: string;
        output: string;
      }>
    : [];

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
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div className="flex h-6 w-6 items-center justify-center rounded gradient-bg">
            <Compass className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm font-semibold">{campaign.name}</span>
          <span className="text-xs text-muted-foreground">
            Step {activeStep} / {enabledStepDefs.length}
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary"
          >
            {sidebarOpen ? "Hide Context" : "Show Context"}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Step Rail */}
        <StepRail
          stepDefs={enabledStepDefs}
          steps={steps}
          activeStep={activeStep}
          onSelectStep={setActiveStep}
        />

        {/* Step Workspace */}
        <div className="flex-1 overflow-y-auto">
          {currentStepDef && currentStepState && (
            <StepWorkspace
              campaignId={campaignId}
              stepDef={currentStepDef}
              stepState={currentStepState}
              outputDisplay={currentStepDef.outputDisplay}
              onRefresh={() => {
                refreshStep(activeStep);
                fetchCampaign();
              }}
            />
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
