"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  FileImage,
  FileCode,
  FileSpreadsheet,
  Trash2,
  Upload,
  Loader2,
  CheckCircle2,
  FolderOpen,
  Plus,
  AlertCircle,
  File,
  BookOpen,
  ClipboardCheck,
  Sparkles,
  Search,
  FlaskConical,
  Lock,
} from "lucide-react";
import type { Campaign, Source, KnowledgeEntry, BriefAssessment } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ACCEPTED_EXTENSIONS,
  SUPPORTED_TYPES_LABEL,
} from "@/lib/file-types";
import { ProgramContext } from "@/components/campaign/program-context";
import { BriefAssessmentPanel } from "@/components/campaign/brief-assessment";

const FILE_TYPE_ICONS: Record<string, typeof FileText> = {
  text: FileText,
  markdown: FileText,
  pdf: File,
  image: FileImage,
  code: FileCode,
  data: FileSpreadsheet,
  notebook: FileCode,
  document: File,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type SetupStep = "sources" | "context" | "assessment" | "research";

const SETUP_STEPS: { id: SetupStep; label: string; icon: typeof FileText }[] = [
  { id: "sources", label: "Sources", icon: Upload },
  { id: "context", label: "Program Context", icon: BookOpen },
  { id: "assessment", label: "Brief Assessment", icon: ClipboardCheck },
  { id: "research", label: "AI Research", icon: Search },
];

export default function CampaignSetup({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = use(params);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [briefAssessment, setBriefAssessment] = useState<BriefAssessment | null>(null);
  const [briefingTemplate, setBriefingTemplate] = useState<Array<{
    id: string;
    label: string;
    enabled: boolean;
    questions: Array<{ id: string; question: string; enabled: boolean }>;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [ingestingSource, setIngestingSource] = useState<string | null>(null);
  const [ingestingAll, setIngestingAll] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSetupStep, setActiveSetupStep] = useState<SetupStep>("sources");

  // AI Research state
  const [researching, setResearching] = useState(false);
  const [researchFindings, setResearchFindings] = useState<
    Array<{
      category: string;
      findings: Array<{ area: string; title: string; content: string; sources: string[] }>;
      status: string;
    }>
  >([]);
  const [selectedFindings, setSelectedFindings] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  // Manual path / folder input
  const [showManual, setShowManual] = useState(false);
  const [manualPath, setManualPath] = useState("");
  const [manualName, setManualName] = useState("");
  const [isFolder, setIsFolder] = useState(false);
  const [addingManual, setAddingManual] = useState(false);

  const fetchTemplate = useCallback(async () => {
    const res = await fetch("/api/admin/briefing-template");
    if (res.ok) setBriefingTemplate(await res.json());
  }, []);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaignId}`);
    if (res.ok) {
      const data = await res.json();
      setCampaign(data);
      setSources(data.sources ?? []);
      setKnowledgeEntries(data.knowledgeEntries ?? []);
      if (data.briefAssessment) {
        try {
          setBriefAssessment(
            typeof data.briefAssessment === "string"
              ? JSON.parse(data.briefAssessment)
              : data.briefAssessment
          );
        } catch { /* ignore */ }
      }
    }
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    fetchData();
    fetchTemplate();
  }, [fetchData, fetchTemplate]);

  // File upload
  async function uploadFiles(files: FileList | File[]) {
    if (!files.length) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    for (const file of Array.from(files)) formData.append("files", file);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/sources`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Upload failed");
      } else {
        await fetchData();
      }
    } catch {
      setError("Upload failed");
    }
    setUploading(false);
  }

  // Add by path or folder
  async function addManualSource(e: React.FormEvent) {
    e.preventDefault();
    if (!manualPath.trim()) return;
    setAddingManual(true);
    setError(null);
    const body = isFolder
      ? { folderPath: manualPath.trim() }
      : { filePath: manualPath.trim(), name: manualName.trim() || undefined };
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to add source");
      } else {
        setManualPath("");
        setManualName("");
        setShowManual(false);
        await fetchData();
      }
    } catch {
      setError("Failed to add source");
    }
    setAddingManual(false);
  }

  async function removeSource(sourceId: string) {
    await fetch(`/api/campaigns/${campaignId}/sources/${sourceId}`, {
      method: "DELETE",
    });
    fetchData();
  }

  // Ingest a single source
  async function ingestSource(sourceId: string) {
    setIngestingSource(sourceId);
    setError(null);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/ingest?sourceId=${sourceId}`,
        { method: "POST" }
      );
      if (res.ok) {
        const data = await res.json();
        const failed = data.results?.filter(
          (r: { status: string }) => r.status === "failed"
        );
        if (failed?.length) {
          setError(`Ingestion failed: ${failed[0]?.error || "Unknown error"}`);
        }
      }
    } catch {
      setError("Ingestion failed");
    }
    await fetchData();
    setIngestingSource(null);
  }

  async function ingestAll() {
    setIngestingAll(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/ingest`,
        { method: "POST" }
      );
      if (res.ok) {
        const data = await res.json();
        const failed = data.results?.filter(
          (r: { status: string }) => r.status === "failed"
        );
        if (failed?.length) {
          setError(failed.map((f: { name: string; error?: string }) => `${f.name}: ${f.error || "Failed"}`).join(". "));
        }
      }
    } catch {
      setError("Ingestion failed");
    }
    await fetchData();
    setIngestingSource(null);
    setIngestingAll(false);
  }

  async function startWorkshop() {
    await fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_progress" }),
    });
    router.push(`/campaign/${campaignId}`);
  }

  // Drag handlers
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
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

  const ingestedCount = sources.filter((s) => s.ingested).length;
  const hasContext = knowledgeEntries.length > 0;

  // Determine which steps are unlocked
  const canGoToContext = ingestedCount > 0;
  const canGoToAssessment = hasContext;
  const canGoToResearch = briefAssessment !== null;

  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-50 px-6 py-4">
        <div className="mx-auto flex max-w-[1200px] items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <div className="divider-brand flex-1" />
          <h1 className="text-base font-semibold">{campaign.name}</h1>
        </div>
      </header>

      {/* Step indicator */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="flex">
            {SETUP_STEPS.map((step, i) => {
              const isActive = activeSetupStep === step.id;
              const isLocked =
                (step.id === "context" && !canGoToContext) ||
                (step.id === "assessment" && !canGoToAssessment) ||
                (step.id === "research" && !canGoToResearch);
              const Icon = step.icon;
              const isDone =
                (step.id === "sources" && ingestedCount > 0) ||
                (step.id === "context" && hasContext) ||
                (step.id === "assessment" && briefAssessment !== null) ||
                (step.id === "research" && researchFindings.length > 0);

              return (
                <button
                  key={step.id}
                  onClick={() => !isLocked && setActiveSetupStep(step.id)}
                  disabled={isLocked}
                  className={cn(
                    "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors",
                    isActive
                      ? "border-primary text-primary"
                      : isLocked
                        ? "border-transparent text-muted-foreground/40 cursor-not-allowed"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {isDone && !isActive ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                    <span>{step.label}</span>
                  </div>
                  {i < SETUP_STEPS.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-muted-foreground/30 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1200px] px-6 py-8 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm text-destructive">{error}</div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-destructive/60 hover:text-destructive text-xs"
            >
              dismiss
            </button>
          </div>
        )}

        {/* ── STEP 1: Sources ── */}
        {activeSetupStep === "sources" && (
          <>
            <section>
              <h2 className="text-lg font-bold mb-1">Source Documents</h2>
              <p className="text-sm text-muted-foreground">
                Add documents, then ingest each one to extract knowledge.
                Supports: {SUPPORTED_TYPES_LABEL}.
              </p>
            </section>

            {/* Drop zone */}
            <section
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={cn(
                "rounded-lg border-2 border-dashed bg-card p-8 text-center transition-colors cursor-pointer",
                dragOver
                  ? "border-primary bg-accent/30"
                  : "border-border hover:border-primary/40"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_EXTENSIONS}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) uploadFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-sm font-medium">Uploading...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium">
                    Drop files here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, images, text, markdown, code, data files, notebooks
                  </p>
                </div>
              )}
            </section>

            {/* Alt add methods */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowManual(true); setIsFolder(false); }}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add by File Path
              </button>
              <button
                onClick={() => { setShowManual(true); setIsFolder(true); }}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors"
              >
                <FolderOpen className="h-3 w-3" />
                Import Folder
              </button>
            </div>

            {/* Manual path form */}
            {showManual && (
              <section className="rounded-lg border border-border bg-card p-5">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  {isFolder ? (
                    <><FolderOpen className="h-4 w-4 text-primary" /> Import Folder</>
                  ) : (
                    <><FileText className="h-4 w-4 text-primary" /> Add by File Path</>
                  )}
                </h3>
                <form onSubmit={addManualSource} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      {isFolder ? "Folder Path" : "File Path"}
                    </label>
                    <input
                      type="text"
                      value={manualPath}
                      onChange={(e) => setManualPath(e.target.value)}
                      placeholder={isFolder ? "C:\\path\\to\\documents\\" : "C:\\path\\to\\document.pdf"}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                      autoFocus
                    />
                    {isFolder && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Scans up to 3 levels deep. Skips node_modules, .git, etc.
                      </p>
                    )}
                  </div>
                  {!isFolder && (
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Display Name (optional)
                      </label>
                      <input
                        type="text"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        placeholder="Auto-detected from filename"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button type="submit" disabled={addingManual || !manualPath.trim()} className="flex items-center gap-1.5 rounded-md gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                      {addingManual && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {isFolder ? "Scan & Import" : "Add Source"}
                    </button>
                    <button type="button" onClick={() => setShowManual(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
                  </div>
                </form>
              </section>
            )}

            {/* Source list with per-source ingest */}
            {sources.length > 0 && (
              <section className="rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                  <h3 className="text-sm font-semibold">
                    Sources ({sources.length})
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {ingestedCount} / {sources.length} ingested
                    </span>
                    {ingestedCount < sources.length && (
                      <button
                        onClick={ingestAll}
                        disabled={ingestingAll || ingestingSource !== null}
                        className="flex items-center gap-1.5 rounded-md gradient-bg px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {ingestingAll ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        {ingestingAll
                          ? `Ingesting ${sources.filter((s) => !s.ingested).length - (ingestingSource ? 0 : 0)}...`
                          : `Ingest All (${sources.length - ingestedCount})`}
                      </button>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {sources.map((s) => {
                    const Icon = FILE_TYPE_ICONS[s.fileType] ?? FileText;
                    const isIngesting = ingestingSource === s.id;
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{s.name}</span>
                            <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{s.fileType}</span>
                            <span className="text-[10px] text-muted-foreground">{formatBytes(s.sizeBytes)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">{s.filePath}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {s.ingested ? (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Ingested
                            </span>
                          ) : (
                            <button
                              onClick={() => ingestSource(s.id)}
                              disabled={isIngesting}
                              className="flex items-center gap-1.5 rounded-md gradient-bg px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                            >
                              {isIngesting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Sparkles className="h-3 w-3" />
                              )}
                              {isIngesting ? "Ingesting..." : "Ingest"}
                            </button>
                          )}
                          <button
                            onClick={() => removeSource(s.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Next step */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveSetupStep("context")}
                disabled={!canGoToContext}
                className="flex items-center gap-2 rounded-md gradient-bg px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                Review Program Context
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: Program Context ── */}
        {activeSetupStep === "context" && (
          <>
            <section>
              <h2 className="text-lg font-bold mb-1">Program Context</h2>
              <p className="text-sm text-muted-foreground">
                All knowledge extracted from your sources, organized by area.
                Edit, add, or remove entries to refine the context before assessment.
              </p>
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <ProgramContext
                campaignId={campaignId}
                entries={knowledgeEntries}
                onRefresh={fetchData}
              />
            </section>

            {/* Birdie Studio Ingest — Beta (disabled) */}
            <section className="rounded-lg border border-border bg-card p-6 opacity-60">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary shrink-0">
                  <FlaskConical className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold">Birdie Studio Ingest</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 text-[10px] font-medium">
                      <FlaskConical className="h-2.5 w-2.5" />
                      Beta
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Automatically pull context from Birdie Studio&apos;s internal knowledge base,
                    past campaign data, and client history to enrich your program context.
                  </p>
                </div>
                <div className="shrink-0">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <button
                disabled
                className="mt-4 w-full flex items-center justify-center gap-2 rounded-md border border-border px-5 py-3 text-sm font-medium text-muted-foreground cursor-not-allowed"
              >
                <Lock className="h-3.5 w-3.5" />
                Coming Soon
              </button>
            </section>

            {/* Navigation */}
            <div className="flex justify-between pt-2">
              <button
                onClick={() => setActiveSetupStep("sources")}
                className="flex items-center gap-2 rounded-md border border-border px-5 py-2 text-sm font-medium hover:bg-secondary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Sources
              </button>
              <button
                onClick={() => setActiveSetupStep("assessment")}
                disabled={!canGoToAssessment}
                className="flex items-center gap-2 rounded-md gradient-bg px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                Run Brief Assessment
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {/* ── STEP 3: Brief Assessment ── */}
        {activeSetupStep === "assessment" && (
          <>
            <section>
              <h2 className="text-lg font-bold mb-1">Brief Assessment Readiness</h2>
              <p className="text-sm text-muted-foreground">
                Assess how well your program context covers the briefing
                template. Identify gaps before starting direction setting.
              </p>
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <BriefAssessmentPanel
                campaignId={campaignId}
                assessment={briefAssessment}
                template={briefingTemplate}
                onRefresh={fetchData}
              />
            </section>

            {/* Navigation */}
            <div className="flex justify-between pt-2">
              <button
                onClick={() => setActiveSetupStep("context")}
                className="flex items-center gap-2 rounded-md border border-border px-5 py-2 text-sm font-medium hover:bg-secondary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Context
              </button>
              <button
                onClick={() => setActiveSetupStep("research")}
                disabled={!canGoToResearch}
                className="flex items-center gap-2 rounded-md gradient-bg px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                AI Research
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}

        {/* ── STEP 4: AI Research ── */}
        {activeSetupStep === "research" && (() => {
          const allFindings = researchFindings.flatMap((r, ci) =>
            r.findings.map((f, fi) => ({ ...f, key: `${ci}-${fi}`, category: r.category }))
          );
          const totalFound = allFindings.length;
          const selectedCount = selectedFindings.size;

          return (
          <>
            <section>
              <h2 className="text-lg font-bold mb-1">AI Research</h2>
              <p className="text-sm text-muted-foreground">
                Research knowledge gaps, review findings, then import the ones you want into your program context.
              </p>
            </section>

            {/* Research action card */}
            <section className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-bg shrink-0">
                  <Search className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold mb-1">Research Gaps & Areas</h3>
                  <p className="text-xs text-muted-foreground">
                    The AI will search the web to fill knowledge gaps from your brief assessment.
                    Results appear below for you to review before importing.
                  </p>
                </div>
              </div>

              {/* Assessment summary */}
              {briefAssessment && totalFound === 0 && (
                <div className="rounded-md border border-border bg-secondary/30 p-4">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">Assessment Summary</h4>
                  <div className="grid grid-cols-3 gap-3 text-center mb-3">
                    <div className="rounded-md bg-card p-2">
                      <div className="text-lg font-bold text-green-600">
                        {briefAssessment.categories.reduce((s, c) => s + c.questions.filter((q) => q.status === "covered").length, 0)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Covered</div>
                    </div>
                    <div className="rounded-md bg-card p-2">
                      <div className="text-lg font-bold text-amber-600">
                        {briefAssessment.categories.reduce((s, c) => s + c.questions.filter((q) => q.status === "partial").length, 0)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Partial</div>
                    </div>
                    <div className="rounded-md bg-card p-2">
                      <div className="text-lg font-bold text-red-500">
                        {briefAssessment.categories.reduce((s, c) => s + c.questions.filter((q) => q.status === "gap").length, 0)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Gaps</div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{briefAssessment.summary}</p>
                </div>
              )}

              <button
                onClick={async () => {
                  setResearching(true);
                  setResearchFindings([]);
                  setSelectedFindings(new Set());
                  try {
                    const res = await fetch(`/api/campaigns/${campaignId}/research`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({}),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      const results: typeof researchFindings = data.agentResults ?? [];
                      setResearchFindings(results);
                      // Auto-select all findings
                      const allKeys = new Set<string>();
                      results.forEach((r: { findings: unknown[] }, ci: number) =>
                        r.findings.forEach((_: unknown, fi: number) => allKeys.add(`${ci}-${fi}`))
                      );
                      setSelectedFindings(allKeys);
                    } else {
                      const err = await res.json();
                      setError(err.error || "Research failed");
                    }
                  } catch {
                    setError("Research failed");
                  }
                  setResearching(false);
                }}
                disabled={researching}
                className="w-full flex items-center justify-center gap-2 rounded-md gradient-bg px-5 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {researching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Researching... This may take a few minutes
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {totalFound > 0 ? "Research Again" : "Start AI Research"}
                  </>
                )}
              </button>
            </section>

            {/* Findings review */}
            {totalFound > 0 && (
              <section className="rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                  <h3 className="text-sm font-semibold">
                    Research Findings ({selectedCount} / {totalFound} selected)
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (selectedCount === totalFound) {
                          setSelectedFindings(new Set());
                        } else {
                          setSelectedFindings(new Set(allFindings.map((f) => f.key)));
                        }
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      {selectedCount === totalFound ? "Deselect All" : "Select All"}
                    </button>
                    <button
                      onClick={async () => {
                        const toImport = allFindings.filter((f) => selectedFindings.has(f.key));
                        if (toImport.length === 0) return;
                        setImporting(true);
                        try {
                          const res = await fetch(`/api/campaigns/${campaignId}/knowledge`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              entries: toImport.map((f) => ({
                                area: f.area,
                                title: f.title,
                                content: f.sources && f.sources.length > 0
                                  ? `${f.content}\n\nSources:\n${f.sources.map((s: string) => `- ${s}`).join("\n")}`
                                  : f.content,
                              })),
                            }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            // Remove imported findings from the list
                            const remaining = researchFindings.map((r, ci) => ({
                              ...r,
                              findings: r.findings.filter((_, fi) => !selectedFindings.has(`${ci}-${fi}`)),
                            })).filter((r) => r.findings.length > 0);
                            setResearchFindings(remaining);
                            setSelectedFindings(new Set());
                            await fetchData();
                            setError(null);
                          }
                        } catch {
                          setError("Import failed");
                        }
                        setImporting(false);
                      }}
                      disabled={importing || selectedCount === 0}
                      className="flex items-center gap-1.5 rounded-md gradient-bg px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {importing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      Import {selectedCount} to Context
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                  {researchFindings.map((catResult, ci) => (
                    catResult.status === "ok" && catResult.findings.length > 0 && (
                      <div key={ci}>
                        <div className="px-5 py-2 bg-secondary/30 flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground">{catResult.category}</span>
                          <span className="text-[10px] text-muted-foreground">{catResult.findings.length} findings</span>
                        </div>
                        {catResult.findings.map((finding, fi) => {
                          const key = `${ci}-${fi}`;
                          const isSelected = selectedFindings.has(key);
                          return (
                            <label
                              key={key}
                              className={cn(
                                "flex items-start gap-3 px-5 py-3 cursor-pointer transition-colors",
                                isSelected ? "bg-primary/5" : "hover:bg-secondary/30"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const next = new Set(selectedFindings);
                                  if (e.target.checked) next.add(key);
                                  else next.delete(key);
                                  setSelectedFindings(next);
                                }}
                                className="mt-1 shrink-0 rounded border-border"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-sm font-medium">{finding.title}</span>
                                  <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                    {finding.area}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-3">
                                  {finding.content}
                                </p>
                                {finding.sources && finding.sources.length > 0 && (
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                                    {finding.sources.map((url: string, si: number) => (
                                      <a
                                        key={si}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-[10px] text-primary hover:underline truncate max-w-[300px]"
                                      >
                                        {url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )
                  ))}
                </div>
              </section>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-2">
              <button
                onClick={() => setActiveSetupStep("assessment")}
                className="flex items-center gap-2 rounded-md border border-border px-5 py-2 text-sm font-medium hover:bg-secondary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Assessment
              </button>
              <button
                onClick={startWorkshop}
                className="flex items-center gap-2 rounded-md gradient-bg px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
              >
                Start Direction Setting
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
          );
        })()}
      </main>
    </div>
  );
}
