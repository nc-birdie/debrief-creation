"use client";

import { useEffect, useState, useCallback, useMemo, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Cpu,
  TrendingUp,
  HeartCrack,
  Swords,
  DollarSign,
  BarChart3,
  Target,
  Shield,
  Building2,
  Lightbulb,
  FileText,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Plus,
  Compass,
  BookOpen,
  CheckCircle2,
  FlaskConical,
  Layers,
  MoreHorizontal,
  Check,
  ClipboardCheck,
  Search,
  Sparkles,
  Loader2,
} from "lucide-react";
import type {
  Campaign,
  KnowledgeEntry,
  Source,
  Artefact,
  StepState,
  BriefAssessment,
} from "@/lib/types";
import { KNOWLEDGE_AREAS } from "@/lib/knowledge-areas";
import type { ArtefactTypeDef } from "@/lib/artefact-types";
import { fetchArtefactTypes } from "@/lib/artefact-types";
import { cn } from "@/lib/utils";
import { SourcesManager } from "@/components/campaign/sources-manager";
import { ServicesSection } from "@/components/campaign/services-section";
import { BriefAssessmentPanel } from "@/components/campaign/brief-assessment";
import { InterviewerChat } from "@/components/campaign/interviewer-chat";

// Icon + accent color per knowledge area
const AREA_META: Record<string, { icon: typeof Cpu; accent: string }> = {
  product_technology: { icon: Cpu, accent: "text-blue-500" },
  market_context: { icon: TrendingUp, accent: "text-emerald-500" },
  customer_pain_points: { icon: HeartCrack, accent: "text-rose-500" },
  competitive_landscape: { icon: Swords, accent: "text-orange-500" },
  business_model: { icon: DollarSign, accent: "text-violet-500" },
  data: { icon: BarChart3, accent: "text-cyan-500" },
  objectives: { icon: Target, accent: "text-pink-500" },
  strategic_context: { icon: Compass, accent: "text-pink-500" },
  regulatory_compliance: { icon: Shield, accent: "text-amber-500" },
  organizational: { icon: Building2, accent: "text-indigo-500" },
  other: { icon: Lightbulb, accent: "text-yellow-500" },
};

export default function CampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [artefacts, setArtefacts] = useState<Artefact[]>([]);
  const [steps, setSteps] = useState<StepState[]>([]);
  const [briefAssessment, setBriefAssessment] = useState<BriefAssessment | null>(null);
  const [briefingTemplate, setBriefingTemplate] = useState<
    Array<{
      id: string;
      label: string;
      enabled: boolean;
      questions: Array<{ id: string; question: string; enabled: boolean }>;
    }>
  >([]);
  const [artefactTypes, setArtefactTypes] = useState<ArtefactTypeDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [showAssessment, setShowAssessment] = useState(false);

  const fetchTemplate = useCallback(async () => {
    const res = await fetch("/api/admin/briefing-template");
    if (res.ok) setBriefingTemplate(await res.json());
  }, []);

  const fetchArtefactTypesData = useCallback(async () => {
    const types = await fetchArtefactTypes();
    setArtefactTypes(types);
  }, []);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaignId}`);
    if (res.ok) {
      const data = await res.json();
      setCampaign(data);
      setEntries(data.knowledgeEntries ?? []);
      setSources(data.sources ?? []);
      setArtefacts(data.artefacts ?? []);
      setSteps(data.steps ?? []);
      if (data.briefAssessment) {
        try {
          setBriefAssessment(
            typeof data.briefAssessment === "string"
              ? JSON.parse(data.briefAssessment)
              : data.briefAssessment
          );
        } catch {
          /* ignore */
        }
      }
    }
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    fetchData();
    fetchTemplate();
    fetchArtefactTypesData();
  }, [fetchData, fetchTemplate, fetchArtefactTypesData]);

  const grouped = useMemo(() => {
    const map = new Map<string, KnowledgeEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.area) ?? [];
      list.push(entry);
      map.set(entry.area, list);
    }
    return map;
  }, [entries]);

  const areasWithEntries = KNOWLEDGE_AREAS.filter(
    (a) => (grouped.get(a.id)?.length ?? 0) > 0
  );
  const ingestedSources = sources.filter((s) => s.ingested);
  const hasContext = entries.length > 0;

  async function startDebrief() {
    await fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress" }),
    });
    router.push(`/campaign/${campaignId}/workshop`);
  }

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
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-6 py-4">
        <div className="mx-auto flex max-w-[1200px] items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <div className="divider-brand" />
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-md gradient-bg shrink-0">
              <Compass className="h-3.5 w-3.5 text-white" />
            </div>
            <h1 className="text-base font-semibold truncate">
              {campaign.name}
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-8 space-y-8">
        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-card px-5 py-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Sources</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {ingestedSources.length}
              </span>
              {sources.length > ingestedSources.length && (
                <span className="text-xs text-muted-foreground">
                  / {sources.length} uploaded
                </span>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card px-5 py-4">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Knowledge Entries</span>
            </div>
            <span className="text-2xl font-bold">{entries.length}</span>
          </div>
          <div className="rounded-lg border border-border bg-card px-5 py-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Areas Covered</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {areasWithEntries.length}
              </span>
              <span className="text-xs text-muted-foreground">
                / {KNOWLEDGE_AREAS.length}
              </span>
            </div>
          </div>
        </div>

        {/* ── Sources ── */}
        <SourcesManager
          campaignId={campaignId}
          sources={sources}
          onRefresh={fetchData}
        />

        {/* ── Program Context ── */}
        {entries.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-border bg-card p-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold mb-2">
              No program context yet
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Upload source documents above and ingest them to build your
              program context. The AI will extract knowledge and organize it
              across {KNOWLEDGE_AREAS.length} areas.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Program Context</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {KNOWLEDGE_AREAS.map((area) => {
                const areaEntries = grouped.get(area.id) ?? [];
                const meta = AREA_META[area.id] ?? {
                  icon: Lightbulb,
                  accent: "text-muted-foreground",
                };
                const Icon = meta.icon;
                const isExpanded = expandedArea === area.id;
                const isEmpty = areaEntries.length === 0;

                return (
                  <div
                    key={area.id}
                    className={cn(
                      "rounded-lg border bg-card flex flex-col transition-all",
                      isEmpty
                        ? "border-dashed border-border/60 opacity-50"
                        : "border-border hover:border-primary/20",
                      isExpanded && "md:col-span-2 xl:col-span-3"
                    )}
                  >
                    <button
                      onClick={() =>
                        !isEmpty &&
                        setExpandedArea(isExpanded ? null : area.id)
                      }
                      disabled={isEmpty}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3.5 text-left transition-colors",
                        !isEmpty && "hover:bg-secondary/30 cursor-pointer"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
                          isEmpty ? "bg-secondary/50" : "bg-secondary"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            isEmpty ? "text-muted-foreground/40" : meta.accent
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate">
                            {area.label}
                          </span>
                          {!isEmpty && (
                            <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium shrink-0">
                              {areaEntries.length}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {area.description}
                        </p>
                      </div>
                      {!isEmpty && (
                        <div className="shrink-0">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </button>

                    {!isExpanded && !isEmpty && (
                      <div className="px-4 pb-3 space-y-1">
                        {areaEntries.slice(0, 3).map((e) => (
                          <div
                            key={e.id}
                            className="text-xs text-muted-foreground truncate flex items-center gap-1.5"
                          >
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                            <span className="truncate">{e.title}</span>
                          </div>
                        ))}
                        {areaEntries.length > 3 && (
                          <div className="text-[10px] text-muted-foreground/60 pl-2.5">
                            +{areaEntries.length - 3} more
                          </div>
                        )}
                      </div>
                    )}

                    {isExpanded && (
                      <div className="border-t border-border">
                        <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                          {areaEntries.map((entry) => (
                            <EntryRow
                              key={entry.id}
                              entry={entry}
                              campaignId={campaignId}
                              onRefresh={fetchData}
                            />
                          ))}
                        </div>
                        <div className="px-4 py-2.5 border-t border-border">
                          <AddEntryInline
                            campaignId={campaignId}
                            area={area.id}
                            onDone={fetchData}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Brief Assessment ── */}
        {hasContext && (
          <div className="rounded-lg border border-border bg-card">
            <button
              onClick={() => setShowAssessment(!showAssessment)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-secondary/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary shrink-0">
                  <ClipboardCheck className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Brief Assessment</h3>
                    {briefAssessment && (
                      <span className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 text-[10px] font-medium">
                        {briefAssessment.overallScore}% coverage
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Assess how well your context covers the briefing template
                  </p>
                </div>
              </div>
              {showAssessment ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>
            {showAssessment && (
              <div className="border-t border-border px-5 py-5">
                <BriefAssessmentPanel
                  campaignId={campaignId}
                  assessment={briefAssessment}
                  template={briefingTemplate}
                  onRefresh={fetchData}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Artefacts ── */}
        <ArtefactsSection
          campaignId={campaignId}
          artefacts={artefacts}
          artefactTypes={artefactTypes}
          hasContext={hasContext}
          briefAssessment={briefAssessment}
          onRefresh={fetchData}
        />

        {/* ── Services ── */}
        <ServicesSection
          campaignId={campaignId}
          campaignStatus={campaign.status}
          steps={steps}
          hasContext={hasContext}
          onStartDebrief={startDebrief}
        />
      </main>

      {/* Interviewer Chat Sidebar */}
      <InterviewerChat
        campaignId={campaignId}
        onKnowledgeRegistered={fetchData}
      />
    </div>
  );
}

// ── Artefacts Section ──

function ArtefactsSection({
  campaignId,
  artefacts,
  artefactTypes,
  hasContext,
  briefAssessment,
  onRefresh,
}: {
  campaignId: string;
  artefacts: Artefact[];
  artefactTypes: ArtefactTypeDef[];
  hasContext: boolean;
  briefAssessment: BriefAssessment | null;
  onRefresh: () => void;
}) {
  const researchArtefacts = artefacts.filter(
    (a) => a.category === "research"
  );
  const directionArtefacts = artefacts.filter(
    (a) => a.category === "direction_setting"
  );

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">Artefacts</h2>

      <ResearchArtefactsSection
        campaignId={campaignId}
        artefacts={researchArtefacts}
        artefactTypes={artefactTypes}
        hasContext={hasContext}
        briefAssessment={briefAssessment}
        onRefresh={onRefresh}
      />

      <ArtefactCategorySection
        campaignId={campaignId}
        category="direction_setting"
        title="Direction Setting Artefacts"
        description="Strategic deliverables and frameworks that shape your direction"
        icon={<Layers className="h-4 w-4 text-violet-500" />}
        artefacts={directionArtefacts}
        artefactTypes={artefactTypes}
        onRefresh={onRefresh}
      />
    </div>
  );
}

// ── Research Artefacts Section (combined AI research + artefact management) ──

function ResearchArtefactsSection({
  campaignId,
  artefacts,
  artefactTypes,
  hasContext,
  briefAssessment,
  onRefresh,
}: {
  campaignId: string;
  artefacts: Artefact[];
  artefactTypes: ArtefactTypeDef[];
  hasContext: boolean;
  briefAssessment: BriefAssessment | null;
  onRefresh: () => void;
}) {
  const types = artefactTypes.filter((t) => t.category === "research");
  const [runningType, setRunningType] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [runAllCompleted, setRunAllCompleted] = useState<Set<string>>(new Set());
  const [planningType, setPlanningType] = useState<string | null>(null);
  const [researchPlan, setResearchPlan] = useState<{
    summary: string;
    sections: Array<{
      title: string;
      priority: string;
      description: string;
      currentCoverage: string;
      researchFocus: string;
    }>;
  } | null>(null);
  const [showFillGaps, setShowFillGaps] = useState(false);
  const [fillingGaps, setFillingGaps] = useState(false);
  const [gapFindings, setGapFindings] = useState<
    Array<{
      category: string;
      findings: Array<{
        area: string;
        title: string;
        content: string;
        sources: string[];
      }>;
      status: string;
    }>
  >([]);
  const [selectedGapFindings, setSelectedGapFindings] = useState<Set<string>>(
    new Set()
  );
  const [importingGaps, setImportingGaps] = useState(false);

  const gapCount = briefAssessment
    ? briefAssessment.categories.reduce(
        (s, c) => s + c.questions.filter((q) => q.status === "gap").length,
        0
      )
    : 0;
  const partialCount = briefAssessment
    ? briefAssessment.categories.reduce(
        (s, c) => s + c.questions.filter((q) => q.status === "partial").length,
        0
      )
    : 0;

  async function planResearch(typeId: string) {
    const typeDef = types.find((t) => t.id === typeId);
    if (!typeDef) return;

    setPlanningType(typeId);
    setResearchPlan(null);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/research/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artefactType: typeId,
          artefactLabel: typeDef.label,
          artefactDescription: typeDef.description,
        }),
      });
      if (res.ok) {
        const plan = await res.json();
        setResearchPlan(plan);
      } else {
        setPlanningType(null);
      }
    } catch {
      setPlanningType(null);
    }
  }

  function cancelPlan() {
    setPlanningType(null);
    setResearchPlan(null);
  }

  async function executeResearch() {
    if (!planningType) return;
    const typeId = planningType;
    setRunningType(typeId);
    setPlanningType(null);
    setResearchPlan(null);

    try {
      await runSingleResearch(typeId);
    } catch {
      /* ignore */
    }

    setRunningType(null);
    onRefresh();
  }

  async function runSingleResearch(typeId: string) {
    const typeDef = types.find((t) => t.id === typeId);
    if (!typeDef) return;

    const createRes = await fetch(`/api/campaigns/${campaignId}/artefacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "research",
        type: typeId,
        name: typeDef.label,
        description: typeDef.description,
      }),
    });
    if (!createRes.ok) return;
    const artefact = await createRes.json();

    const res = await fetch(`/api/campaigns/${campaignId}/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artefactType: typeId }),
    });

    if (!res.ok) return;
    const data = await res.json();
    const allFindings = (data.agentResults ?? []).flatMap(
      (r: { findings: Array<{ content: string }> }) => r.findings
    );

    if (allFindings.length > 0) {
      const content = allFindings
        .map((f: { title: string; content: string; sources?: string[] }) => {
          let entry = `## ${f.title}\n\n${f.content}`;
          if (f.sources?.length) entry += `\n\n**Sources:** ${f.sources.join(", ")}`;
          return entry;
        })
        .join("\n\n---\n\n");

      await fetch(`/api/campaigns/${campaignId}/artefacts/${artefact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      await fetch(`/api/campaigns/${campaignId}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: allFindings.map(
            (f: { area: string; title: string; content: string; sources?: string[] }) => ({
              area: f.area,
              title: f.title,
              content:
                f.sources && f.sources.length > 0
                  ? `${f.content}\n\nSources:\n${f.sources.map((s: string) => `- ${s}`).join("\n")}`
                  : f.content,
            })
          ),
        }),
      });
    }
  }

  async function runAll() {
    setRunningAll(true);
    setRunAllCompleted(new Set());

    await Promise.all(
      types.map(async (t) => {
        try {
          await runSingleResearch(t.id);
        } catch {
          /* continue others */
        }
        setRunAllCompleted((prev) => new Set([...prev, t.id]));
      })
    );

    setRunningAll(false);
    onRefresh();
  }

  async function fillGaps() {
    setFillingGaps(true);
    setGapFindings([]);
    setSelectedGapFindings(new Set());
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        const results = data.agentResults ?? [];
        setGapFindings(results);
        const allKeys = new Set<string>();
        results.forEach(
          (
            r: { findings: Array<unknown> },
            ci: number
          ) => r.findings.forEach((_: unknown, fi: number) => allKeys.add(`${ci}-${fi}`))
        );
        setSelectedGapFindings(allKeys);
      }
    } catch {
      /* ignore */
    }
    setFillingGaps(false);
  }

  const allGapFindings = gapFindings.flatMap((r, ci) =>
    r.findings.map((f, fi) => ({ ...f, key: `${ci}-${fi}`, category: r.category }))
  );

  async function importGapFindings() {
    const toImport = allGapFindings.filter((f) =>
      selectedGapFindings.has(f.key)
    );
    if (toImport.length === 0) return;
    setImportingGaps(true);
    await fetch(`/api/campaigns/${campaignId}/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: toImport.map((f) => ({
          area: f.area,
          title: f.title,
          content:
            f.sources?.length > 0
              ? `${f.content}\n\nSources:\n${f.sources.map((s: string) => `- ${s}`).join("\n")}`
              : f.content,
        })),
      }),
    });
    setGapFindings([]);
    setSelectedGapFindings(new Set());
    setImportingGaps(false);
    onRefresh();
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary shrink-0">
            <FlaskConical className="h-4 w-4 text-cyan-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Research</h3>
              {artefacts.length > 0 && (
                <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
                  {artefacts.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Launch AI-powered research reports or fill knowledge gaps
            </p>
          </div>
        </div>
      </div>

      {/* Research type launcher grid */}
      {hasContext && !planningType && !runningType && !runningAll && (
        <div className="px-5 py-4 border-b border-border">
          <p className="text-xs font-medium text-muted-foreground mb-3">
            Launch a research report
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {types.map((t) => {
              const existing = artefacts.filter((a) => a.type === t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => planResearch(t.id)}
                  className="relative rounded-lg border border-border px-3 py-2.5 text-left transition-all hover:border-primary/30 hover:bg-secondary/30"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <Sparkles className="h-3 w-3 text-cyan-500 shrink-0" />
                    <span className="text-xs font-medium truncate">
                      {t.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-1 pl-5">
                    {t.description}
                  </p>
                  {existing.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[9px] font-medium text-primary">
                      {existing.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Run all button */}
          <button
            onClick={runAll}
            className="mt-3 w-full rounded-md border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3 text-left hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-xs font-medium">Run all research reports</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 pl-[22px]">
              Warning: This will take some time and use a substantial amount of tokens
            </p>
          </button>

          {/* Fill gaps from brief assessment */}
          <button
            onClick={() =>
              showFillGaps ? setShowFillGaps(false) : (setShowFillGaps(true), fillGaps())
            }
            disabled={fillingGaps || !briefAssessment || (gapCount === 0 && partialCount === 0)}
            className="mt-2 w-full flex items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-2.5 text-xs text-muted-foreground hover:bg-secondary/30 hover:text-foreground transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground disabled:cursor-not-allowed"
          >
            {fillingGaps ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Researching gaps... This may take a few minutes
              </>
            ) : (
              <>
                <Search className="h-3.5 w-3.5" />
                Fill knowledge gaps from brief assessment
                {briefAssessment && (gapCount > 0 || partialCount > 0) && (
                  <span className="text-[10px] text-muted-foreground/70">
                    ({gapCount} gaps, {partialCount} partial)
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      )}

      {/* Planning state */}
      {planningType && (
        <div className="px-5 py-4 border-b border-border">
          {!researchPlan ? (
            <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-sm">
                Analyzing context and planning research for{" "}
                <span className="font-medium text-foreground">
                  {types.find((t) => t.id === planningType)?.label}
                </span>
                ...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-cyan-500" />
                    Research Plan: {types.find((t) => t.id === planningType)?.label}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {researchPlan.summary}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {(["must-have", "should-have", "nice-to-have"] as const).map(
                  (priority) => {
                    const sections = researchPlan.sections.filter(
                      (s) => s.priority === priority
                    );
                    if (sections.length === 0) return null;
                    const colors = {
                      "must-have": {
                        badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                        border: "border-red-200 dark:border-red-900/40",
                      },
                      "should-have": {
                        badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                        border: "border-amber-200 dark:border-amber-900/40",
                      },
                      "nice-to-have": {
                        badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                        border: "border-blue-200 dark:border-blue-900/40",
                      },
                    };
                    const c = colors[priority];
                    return (
                      <div key={priority} className="space-y-1.5">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                            c.badge
                          )}
                        >
                          {priority} ({sections.length})
                        </span>
                        {sections.map((section, i) => (
                          <div
                            key={i}
                            className={cn(
                              "rounded-md border p-3 space-y-1",
                              c.border,
                              "bg-card"
                            )}
                          >
                            <p className="text-xs font-medium">
                              {section.title}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {section.description}
                            </p>
                            {section.currentCoverage &&
                              section.currentCoverage !== "none" && (
                                <p className="text-[10px] text-muted-foreground/70">
                                  <span className="font-medium">
                                    Current coverage:
                                  </span>{" "}
                                  {section.currentCoverage}
                                </p>
                              )}
                            <p className="text-[10px] text-primary/80">
                              <span className="font-medium">Focus:</span>{" "}
                              {section.researchFocus}
                            </p>
                          </div>
                        ))}
                      </div>
                    );
                  }
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={executeResearch}
                  className="flex items-center gap-1.5 rounded-md gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Start Research
                </button>
                <button
                  onClick={cancelPlan}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Running single state */}
      {runningType && !runningAll && (
        <div className="px-5 py-6 border-b border-border">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm">
              Researching{" "}
              <span className="font-medium text-foreground">
                {types.find((t) => t.id === runningType)?.label}
              </span>
              ... This may take a few minutes
            </p>
          </div>
        </div>
      )}

      {/* Running all state */}
      {runningAll && (
        <div className="px-5 py-5 border-b border-border space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Running all research reports ({runAllCompleted.size}/{types.length} complete)
          </div>
          <div className="space-y-1.5">
            {types.map((t) => {
              const done = runAllCompleted.has(t.id);
              return (
                <div key={t.id} className="flex items-center gap-2.5 px-1">
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                  )}
                  <span className={cn("text-xs", done ? "text-foreground" : "text-muted-foreground")}>
                    {t.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Gap research findings review */}
      {showFillGaps && allGapFindings.length > 0 && (
        <div className="border-b border-border">
          <div className="flex items-center justify-between px-5 py-2.5 bg-secondary/20">
            <span className="text-xs font-semibold">
              Gap findings ({selectedGapFindings.size} / {allGapFindings.length}{" "}
              selected)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  selectedGapFindings.size === allGapFindings.length
                    ? setSelectedGapFindings(new Set())
                    : setSelectedGapFindings(
                        new Set(allGapFindings.map((f) => f.key))
                      )
                }
                className="text-[10px] text-primary hover:underline"
              >
                {selectedGapFindings.size === allGapFindings.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
              <button
                onClick={importGapFindings}
                disabled={importingGaps || selectedGapFindings.size === 0}
                className="flex items-center gap-1 rounded-md gradient-bg px-2.5 py-1 text-[10px] font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {importingGaps ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-2.5 w-2.5" />
                )}
                Import {selectedGapFindings.size}
              </button>
            </div>
          </div>
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {gapFindings.map(
              (catResult, ci) =>
                catResult.status === "ok" &&
                catResult.findings.length > 0 && (
                  <div key={ci}>
                    <div className="px-4 py-2 bg-secondary/10">
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {catResult.category} — {catResult.findings.length}{" "}
                        findings
                      </span>
                    </div>
                    {catResult.findings.map((finding, fi) => {
                      const key = `${ci}-${fi}`;
                      const isSelected = selectedGapFindings.has(key);
                      return (
                        <label
                          key={key}
                          className={cn(
                            "flex items-start gap-3 px-4 py-2.5 cursor-pointer transition-colors",
                            isSelected
                              ? "bg-primary/5"
                              : "hover:bg-secondary/30"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const next = new Set(selectedGapFindings);
                              if (e.target.checked) next.add(key);
                              else next.delete(key);
                              setSelectedGapFindings(next);
                            }}
                            className="mt-0.5 shrink-0 rounded border-border"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium">
                              {finding.title}
                            </span>
                            <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                              {finding.content}
                            </p>
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

      {/* Existing artefacts */}
      {artefacts.length > 0 ? (
        <div className="divide-y divide-border">
          {artefacts.map((artefact) => (
            <ArtefactCard
              key={artefact.id}
              artefact={artefact}
              artefactTypes={artefactTypes}
              campaignId={campaignId}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      ) : (
        !hasContext && (
          <div className="px-5 py-8 text-center">
            <p className="text-xs text-muted-foreground">
              Upload and ingest source documents first to enable AI research.
            </p>
          </div>
        )
      )}
    </div>
  );
}

function ArtefactCategorySection({
  campaignId,
  category,
  title,
  description,
  icon,
  artefacts,
  artefactTypes,
  onRefresh,
}: {
  campaignId: string;
  category: "research" | "direction_setting";
  title: string;
  description: string;
  icon: React.ReactNode;
  artefacts: Artefact[];
  artefactTypes: ArtefactTypeDef[];
  onRefresh: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{title}</h3>
              {artefacts.length > 0 && (
                <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
                  {artefacts.length}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {description}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors shrink-0"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>

      {showCreate && (
        <div className="border-b border-border">
          <CreateArtefactForm
            campaignId={campaignId}
            category={category}
            artefactTypes={artefactTypes}
            onDone={() => {
              setShowCreate(false);
              onRefresh();
            }}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {artefacts.length > 0 ? (
        <div className="divide-y divide-border">
          {artefacts.map((artefact) => (
            <ArtefactCard
              key={artefact.id}
              artefact={artefact}
              artefactTypes={artefactTypes}
              campaignId={campaignId}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      ) : !showCreate ? (
        <div className="px-5 py-8 text-center">
          <p className="text-xs text-muted-foreground">
            No artefacts yet. Click &ldquo;Add&rdquo; to create one.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ArtefactCard({
  artefact,
  artefactTypes,
  campaignId,
  onRefresh,
}: {
  artefact: Artefact;
  artefactTypes: ArtefactTypeDef[];
  campaignId: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(artefact.name);
  const [editDesc, setEditDesc] = useState(artefact.description);
  const [editContent, setEditContent] = useState(artefact.content);
  const [showMenu, setShowMenu] = useState(false);

  const typeDef = artefactTypes.find((t) => t.id === artefact.type);

  async function save() {
    await fetch(`/api/campaigns/${campaignId}/artefacts/${artefact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        description: editDesc,
        content: editContent,
      }),
    });
    setEditing(false);
    onRefresh();
  }

  async function toggleStatus() {
    await fetch(`/api/campaigns/${campaignId}/artefacts/${artefact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: artefact.status === "draft" ? "final" : "draft",
      }),
    });
    setShowMenu(false);
    onRefresh();
  }

  async function remove() {
    await fetch(`/api/campaigns/${campaignId}/artefacts/${artefact.id}`, {
      method: "DELETE",
    });
    onRefresh();
  }

  return (
    <div className="group">
      <div className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/20 transition-colors">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center gap-3 text-left min-w-0"
        >
          <div className="shrink-0">
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">
                {artefact.name}
              </span>
              <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {typeDef?.label ?? artefact.type}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  artefact.status === "final"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                )}
              >
                {artefact.status === "final" ? "Final" : "Draft"}
              </span>
            </div>
            {artefact.description && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {artefact.description}
              </p>
            )}
          </div>
        </button>

        <div className="relative shrink-0">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded hover:bg-secondary opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-50 rounded-md border border-border bg-card shadow-lg py-1 min-w-[140px]">
                <button
                  onClick={() => {
                    setEditing(true);
                    setExpanded(true);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary text-left"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                <button
                  onClick={toggleStatus}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary text-left"
                >
                  <Check className="h-3 w-3" />
                  Mark as {artefact.status === "final" ? "Draft" : "Final"}
                </button>
                <button
                  onClick={() => {
                    remove();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary text-left text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-4 pl-12">
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground mb-1">
                  Content
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={8}
                  className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                />
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={save}
                  className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditName(artefact.name);
                    setEditDesc(artefact.description);
                    setEditContent(artefact.content);
                  }}
                  className="rounded border border-border px-3 py-1 text-xs hover:bg-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : artefact.content ? (
            <div className="rounded-md border border-border bg-secondary/20 p-4">
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {artefact.content}
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border p-4 text-center">
              <p className="text-xs text-muted-foreground mb-2">
                No content yet
              </p>
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-primary hover:underline"
              >
                Add content
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CreateArtefactForm({
  campaignId,
  category,
  artefactTypes,
  onDone,
  onCancel,
}: {
  campaignId: string;
  category: "research" | "direction_setting";
  artefactTypes: ArtefactTypeDef[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const types = artefactTypes.filter((t) => t.category === category);
  const [selectedType, setSelectedType] = useState(types[0]?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function selectType(typeId: string) {
    setSelectedType(typeId);
    const typeDef = types.find((t) => t.id === typeId);
    const prevTypeDef = types.find((t) => t.id === selectedType);
    if (typeDef && (!name || name === prevTypeDef?.label)) {
      setName(typeDef.label);
    }
  }

  async function submit() {
    if (!name.trim() || !selectedType) return;
    await fetch(`/api/campaigns/${campaignId}/artefacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        type: selectedType,
        name: name.trim(),
        description: description.trim(),
      }),
    });
    onDone();
  }

  return (
    <div className="p-5 space-y-4">
      <div>
        <label className="block text-xs font-medium mb-2">Type</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {types.map((t) => (
            <button
              key={t.id}
              onClick={() => selectType(t.id)}
              className={cn(
                "rounded-md border px-3 py-2 text-left transition-colors",
                selectedType === t.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30 hover:bg-secondary/30"
              )}
            >
              <span className="text-xs font-medium block">{t.label}</span>
              <span className="text-[10px] text-muted-foreground line-clamp-1">
                {t.description}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Artefact name..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">
          Description{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={!name.trim() || !selectedType}
          className="flex items-center gap-1.5 rounded-md gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          Create Artefact
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Entry Row ──

function EntryRow({
  entry,
  campaignId,
  onRefresh,
}: {
  entry: KnowledgeEntry;
  campaignId: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(entry.title);
  const [editContent, setEditContent] = useState(entry.content);

  async function saveEdit() {
    await fetch(`/api/campaigns/${campaignId}/knowledge/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, content: editContent }),
    });
    setEditing(false);
    onRefresh();
  }

  async function deleteEntry() {
    await fetch(`/api/campaigns/${campaignId}/knowledge/${entry.id}`, {
      method: "DELETE",
    });
    onRefresh();
  }

  if (editing) {
    return (
      <div className="px-5 py-3 space-y-2">
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={4}
          className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-y"
        />
        <div className="flex gap-1.5">
          <button
            onClick={saveEdit}
            className="rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700"
          >
            Save
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setEditTitle(entry.title);
              setEditContent(entry.content);
            }}
            className="rounded border border-border px-2.5 py-1 text-xs hover:bg-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group px-5 py-3 hover:bg-secondary/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left min-w-0"
        >
          <span className="text-sm font-medium">{entry.title}</span>
          {entry.sourceName && (
            <span className="ml-2 text-[10px] text-muted-foreground/50 font-normal">
              {entry.sourceName}
            </span>
          )}
        </button>
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            className="p-1 hover:bg-secondary rounded"
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
          <button
            onClick={deleteEntry}
            className="p-1 hover:bg-secondary rounded"
          >
            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {entry.content}
          </p>
          {entry.sourceName && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <FileText className="h-2.5 w-2.5" />
              {entry.sourceName}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Inline Add Entry ──

function AddEntryInline({
  campaignId,
  area,
  onDone,
}: {
  campaignId: string;
  area: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  async function submit() {
    if (!title.trim() || !content.trim()) return;
    await fetch(`/api/campaigns/${campaignId}/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        area,
        title: title.trim(),
        content: content.trim(),
      }),
    });
    setTitle("");
    setContent("");
    setOpen(false);
    onDone();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
      >
        <Plus className="h-3 w-3" />
        Add entry
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Entry title..."
        className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        autoFocus
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Content..."
        rows={3}
        className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-y"
      />
      <div className="flex gap-1.5">
        <button
          onClick={submit}
          disabled={!title.trim() || !content.trim()}
          className="rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Add
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setTitle("");
            setContent("");
          }}
          className="rounded border border-border px-2.5 py-1 text-xs hover:bg-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
