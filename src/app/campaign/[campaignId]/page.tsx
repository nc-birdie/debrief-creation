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
import {
  ARTEFACT_TYPES,
  getArtefactType,
  getResearchTypes,
  getDirectionSettingTypes,
} from "@/lib/artefact-types";
import { cn } from "@/lib/utils";
import { SourcesManager } from "@/components/campaign/sources-manager";
import { ServicesSection } from "@/components/campaign/services-section";
import { BriefAssessmentPanel } from "@/components/campaign/brief-assessment";
import { AIResearchSection } from "@/components/campaign/ai-research-section";

// Icon + accent color per knowledge area
const AREA_META: Record<string, { icon: typeof Cpu; accent: string }> = {
  product_technology: { icon: Cpu, accent: "text-blue-500" },
  market_context: { icon: TrendingUp, accent: "text-emerald-500" },
  customer_pain_points: { icon: HeartCrack, accent: "text-rose-500" },
  competitive_landscape: { icon: Swords, accent: "text-orange-500" },
  business_model: { icon: DollarSign, accent: "text-violet-500" },
  data_metrics: { icon: BarChart3, accent: "text-cyan-500" },
  strategic_context: { icon: Target, accent: "text-pink-500" },
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
  const [loading, setLoading] = useState(true);
  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [showAssessment, setShowAssessment] = useState(false);

  const fetchTemplate = useCallback(async () => {
    const res = await fetch("/api/admin/briefing-template");
    if (res.ok) setBriefingTemplate(await res.json());
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
  }, [fetchData, fetchTemplate]);

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

        {/* ── AI Research ── */}
        {hasContext && (
          <AIResearchSection
            campaignId={campaignId}
            briefAssessment={briefAssessment}
            onRefresh={fetchData}
          />
        )}

        {/* ── Artefacts ── */}
        <ArtefactsSection
          campaignId={campaignId}
          artefacts={artefacts}
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
    </div>
  );
}

// ── Artefacts Section ──

function ArtefactsSection({
  campaignId,
  artefacts,
  onRefresh,
}: {
  campaignId: string;
  artefacts: Artefact[];
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

      <ArtefactCategorySection
        campaignId={campaignId}
        category="research"
        title="Research Artefacts"
        description="Reports, analyses, and research that inform your strategy"
        icon={<FlaskConical className="h-4 w-4 text-cyan-500" />}
        artefacts={researchArtefacts}
        onRefresh={onRefresh}
      />

      <ArtefactCategorySection
        campaignId={campaignId}
        category="direction_setting"
        title="Direction Setting Artefacts"
        description="Strategic deliverables and frameworks that shape your direction"
        icon={<Layers className="h-4 w-4 text-violet-500" />}
        artefacts={directionArtefacts}
        onRefresh={onRefresh}
      />
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
  onRefresh,
}: {
  campaignId: string;
  category: "research" | "direction_setting";
  title: string;
  description: string;
  icon: React.ReactNode;
  artefacts: Artefact[];
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
  campaignId,
  onRefresh,
}: {
  artefact: Artefact;
  campaignId: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(artefact.name);
  const [editDesc, setEditDesc] = useState(artefact.description);
  const [editContent, setEditContent] = useState(artefact.content);
  const [showMenu, setShowMenu] = useState(false);

  const typeDef = getArtefactType(artefact.type);

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
  onDone,
  onCancel,
}: {
  campaignId: string;
  category: "research" | "direction_setting";
  onDone: () => void;
  onCancel: () => void;
}) {
  const types =
    category === "research" ? getResearchTypes() : getDirectionSettingTypes();
  const [selectedType, setSelectedType] = useState(types[0]?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function selectType(typeId: string) {
    setSelectedType(typeId);
    const typeDef = ARTEFACT_TYPES.find((t) => t.id === typeId);
    if (typeDef && !name) {
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
