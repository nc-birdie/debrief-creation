"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Settings,
  Save,
  Plus,
  Trash2,
  ClipboardCheck,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  Search,
} from "lucide-react";
import type { StepDefinition } from "@/lib/steps/definitions";
import { cn } from "@/lib/utils";

interface ResearchAgentData {
  id: string;
  categoryId: string;
  category: { id: string; label: string; sortOrder: number; enabled: boolean };
  name: string;
  instructions: string;
  allowedTools: string[];
  maxTurns: number;
  enabled: boolean;
}

interface BriefingQuestionData {
  id: string;
  question: string;
  enabled: boolean;
  sortOrder: number;
}

interface BriefingCategoryData {
  id: string;
  label: string;
  enabled: boolean;
  sortOrder: number;
  questions: BriefingQuestionData[];
}

const ALL_TOOLS = ["Read", "Glob", "Grep", "WebSearch", "WebFetch", "Bash", "Write", "Edit"];

const DISPLAY_TYPES = [
  { id: "prose", label: "Prose", description: "Rendered markdown text" },
  { id: "bullet-cards", label: "Cards", description: "Each section as a visual card" },
  { id: "table", label: "Table", description: "Structured data table" },
  { id: "kpi-grid", label: "KPI Grid", description: "Metric tiles with targets" },
  { id: "statement-cards", label: "Statements", description: "Get/To/By strategy cards" },
  { id: "swot-grid", label: "SWOT Grid", description: "2×2 quadrant analysis matrix" },
  { id: "timeline", label: "Timeline", description: "Sequential phases or milestones" },
  { id: "comparison", label: "Comparison", description: "Side-by-side option comparison" },
  { id: "checklist", label: "Checklist", description: "Action items with status" },
  { id: "ranked-list", label: "Ranked List", description: "Prioritized items with scores" },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"steps" | "research" | "briefing">("steps");
  const [stepDefs, setStepDefs] = useState<StepDefinition[]>([]);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [briefingCategories, setBriefingCategories] = useState<BriefingCategoryData[]>([]);
  const [researchAgents, setResearchAgents] = useState<ResearchAgentData[]>([]);
  const [activeResearchAgentId, setActiveResearchAgentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addingStep, setAddingStep] = useState(false);

  const fetchSteps = useCallback(async () => {
    const res = await fetch("/api/admin/steps");
    if (res.ok) {
      const data: StepDefinition[] = await res.json();
      setStepDefs(data);
      if (!activeStepId && data.length > 0) setActiveStepId(data[0].id);
    }
  }, [activeStepId]);

  const fetchBriefing = useCallback(async () => {
    const res = await fetch("/api/admin/briefing-template");
    if (res.ok) setBriefingCategories(await res.json());
  }, []);

  const fetchResearchAgents = useCallback(async () => {
    const res = await fetch("/api/admin/research-agents");
    if (res.ok) {
      const data: ResearchAgentData[] = await res.json();
      setResearchAgents(data);
      if (!activeResearchAgentId && data.length > 0) setActiveResearchAgentId(data[0].id);
    }
  }, [activeResearchAgentId]);

  useEffect(() => {
    fetchSteps();
    fetchBriefing();
    fetchResearchAgents();
  }, [fetchSteps, fetchBriefing, fetchResearchAgents]);

  const activeStepDef = stepDefs.find((s) => s.id === activeStepId) ?? null;

  // Local editing state for the active step
  const [editForm, setEditForm] = useState<StepDefinition | null>(null);
  useEffect(() => {
    setEditForm(activeStepDef ? { ...activeStepDef } : null);
  }, [activeStepId, activeStepDef]);

  function updateForm(patch: Partial<StepDefinition>) {
    if (editForm) setEditForm({ ...editForm, ...patch });
  }

  async function saveStep() {
    if (!editForm || !activeStepId) return;
    setSaving(true);
    await fetch(`/api/admin/steps/${activeStepId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    await fetchSteps();
    setSaving(false);
  }

  async function deleteStep(id: string) {
    if (!confirm("Delete this step? This cannot be undone.")) return;
    await fetch(`/api/admin/steps/${id}`, { method: "DELETE" });
    setActiveStepId(null);
    await fetchSteps();
  }

  async function addStep(title: string, shortTitle: string, insertAt?: number) {
    const res = await fetch("/api/admin/steps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, shortTitle, insertAt }),
    });
    if (res.ok) {
      const step = await res.json();
      setActiveStepId(step.id);
      setAddingStep(false);
      await fetchSteps();
    }
  }

  async function moveStep(stepId: string, newNumber: number) {
    await fetch("/api/admin/steps/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId, newNumber }),
    });
    await fetchSteps();
  }

  async function toggleStep(id: string, enabled: boolean) {
    await fetch(`/api/admin/steps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    await fetchSteps();
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="glass shrink-0 px-6 py-4 z-50">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <Settings className="h-4 w-4 text-primary" />
          <h1 className="text-base font-bold">Admin Configuration</h1>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left nav */}
        <nav className="w-64 shrink-0 border-r border-border bg-sidebar overflow-y-auto">
          <div className="p-3 space-y-4">
            <div className="flex rounded-md border border-border overflow-hidden">
              {(["steps", "research", "briefing"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-medium text-center capitalize",
                    activeTab === tab ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "steps" ? (
              <div className="space-y-1">
                {stepDefs.map((def, idx) => (
                  <div key={def.id} className="flex items-center gap-0.5">
                    <div className="flex flex-col shrink-0">
                      <button
                        onClick={() => moveStep(def.id, def.number - 1)}
                        disabled={idx === 0}
                        className="p-0 text-muted-foreground hover:text-foreground disabled:opacity-20"
                        title="Move up"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => moveStep(def.id, def.number + 1)}
                        disabled={idx === stepDefs.length - 1}
                        className="p-0 text-muted-foreground hover:text-foreground disabled:opacity-20"
                        title="Move down"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                    <button
                      onClick={() => setActiveStepId(def.id)}
                      className={cn(
                        "flex-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs min-w-0",
                        activeStepId === def.id ? "bg-accent text-accent-foreground" : "hover:bg-secondary/60",
                        !def.enabled && "opacity-50"
                      )}
                    >
                      <span className="text-muted-foreground w-4 text-right shrink-0">{def.number}.</span>
                      <span className={cn("truncate", !def.enabled && "line-through")}>{def.shortTitle}</span>
                    </button>
                    <button
                      onClick={() => toggleStep(def.id, !def.enabled)}
                      className="p-0.5 shrink-0"
                      title={def.enabled ? "Disable" : "Enable"}
                    >
                      {def.enabled ? (
                        <ToggleRight className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setAddingStep(true)}
                  className="w-full flex items-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary mt-2"
                >
                  <Plus className="h-3 w-3" />
                  Add Step
                </button>
              </div>
            ) : activeTab === "research" ? (
              <div className="space-y-1">
                {researchAgents.map((ra) => (
                  <div key={ra.id} className="flex items-center gap-1">
                    <button
                      onClick={() => setActiveResearchAgentId(ra.id)}
                      className={cn(
                        "flex-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs min-w-0",
                        activeResearchAgentId === ra.id ? "bg-accent text-accent-foreground" : "hover:bg-secondary/60",
                        !ra.enabled && "opacity-50"
                      )}
                    >
                      <Search className="h-3 w-3 text-primary shrink-0" />
                      <span className={cn("truncate", !ra.enabled && "line-through")}>{ra.name}</span>
                    </button>
                    <button
                      onClick={async () => {
                        await fetch(`/api/admin/research-agents/${ra.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ enabled: !ra.enabled }),
                        });
                        fetchResearchAgents();
                      }}
                      className="p-0.5 shrink-0"
                      title={ra.enabled ? "Disable" : "Enable"}
                    >
                      {ra.enabled ? (
                        <ToggleRight className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <BriefingSidebar categories={briefingCategories} />
            )}
          </div>
        </nav>

        {/* Right editor */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === "steps" && addingStep ? (
            <AddStepForm onAdd={addStep} onCancel={() => setAddingStep(false)} totalSteps={stepDefs.length} />
          ) : activeTab === "steps" && editForm ? (
            <StepEditor
              form={editForm}
              allSteps={stepDefs}
              onUpdate={updateForm}
              onSave={saveStep}
              onDelete={() => deleteStep(editForm.id)}
              saving={saving}
            />
          ) : activeTab === "steps" ? (
            <div className="text-center py-20 text-muted-foreground text-sm">Select a step or add a new one.</div>
          ) : activeTab === "research" && activeResearchAgentId ? (
            <ResearchAgentEditor
              agent={researchAgents.find((a) => a.id === activeResearchAgentId)!}
              onSave={async (updated) => {
                setSaving(true);
                await fetch(`/api/admin/research-agents/${updated.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(updated),
                });
                await fetchResearchAgents();
                setSaving(false);
              }}
              saving={saving}
            />
          ) : activeTab === "research" ? (
            <div className="text-center py-20 text-muted-foreground text-sm">Select a research agent to configure.</div>
          ) : activeTab === "briefing" ? (
            <BriefingTemplateEditor categories={briefingCategories} onRefresh={fetchBriefing} />
          ) : null}
        </main>
      </div>
    </div>
  );
}

// ── Step Editor ──

function StepEditor({
  form,
  allSteps,
  onUpdate,
  onSave,
  onDelete,
  saving,
}: {
  form: StepDefinition;
  allSteps: StepDefinition[];
  onUpdate: (patch: Partial<StepDefinition>) => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const otherSteps = allSteps.filter((s) => s.number !== form.number);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Step {form.number}: {form.shortTitle}</h2>
        <button onClick={onDelete} className="flex items-center gap-1 text-xs text-destructive hover:underline">
          <Trash2 className="h-3 w-3" /> Delete Step
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Short Title</label>
          <input
            type="text"
            value={form.shortTitle}
            onChange={(e) => onUpdate({ shortTitle: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          rows={2}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Depends On</label>
        <p className="text-xs text-muted-foreground mb-2">
          Which steps must be completed before this one? Their approved output feeds into this step's context.
        </p>
        <div className="flex flex-wrap gap-2">
          {otherSteps.map((s) => {
            const checked = form.dependsOn.includes(s.number);
            return (
              <label
                key={s.id}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs cursor-pointer",
                  checked ? "border-primary/40 bg-primary/10 text-primary" : "border-border hover:bg-secondary"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...form.dependsOn, s.number].sort((a, b) => a - b)
                      : form.dependsOn.filter((n) => n !== s.number);
                    onUpdate({ dependsOn: next });
                  }}
                  className="sr-only"
                />
                {s.number}. {s.shortTitle}
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Custom Instructions</label>
        <textarea
          value={form.customInstructions}
          onChange={(e) => onUpdate({ customInstructions: e.target.value })}
          rows={6}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y font-mono"
          placeholder="Instructions for the AI when generating this step..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Output Format</label>
        <textarea
          value={form.outputFormat}
          onChange={(e) => onUpdate({ outputFormat: e.target.value })}
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y font-mono"
          placeholder="How the AI should structure its output..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Display Type</label>
        <div className="flex flex-wrap gap-2">
          {DISPLAY_TYPES.map((dt) => (
            <label
              key={dt.id}
              className={cn(
                "flex flex-col rounded-md border px-3 py-2 cursor-pointer transition-colors",
                form.outputDisplay === dt.id ? "border-primary/40 bg-primary/10" : "border-border hover:bg-secondary"
              )}
            >
              <input type="radio" value={dt.id} checked={form.outputDisplay === dt.id} onChange={() => onUpdate({ outputDisplay: dt.id })} className="sr-only" />
              <span className={cn("text-xs font-medium", form.outputDisplay === dt.id ? "text-primary" : "")}>{dt.label}</span>
              <span className="text-[10px] text-muted-foreground">{dt.description}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Allowed Tools</label>
        <div className="flex flex-wrap gap-2">
          {ALL_TOOLS.map((tool) => {
            const checked = form.allowedTools.includes(tool);
            return (
              <label
                key={tool}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs cursor-pointer",
                  checked ? "border-primary/40 bg-primary/10 text-primary" : "border-border hover:bg-secondary"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked ? [...form.allowedTools, tool] : form.allowedTools.filter((t) => t !== tool);
                    onUpdate({ allowedTools: next });
                  }}
                  className="sr-only"
                />
                {tool}
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Max Turns</label>
        <input
          type="number"
          value={form.maxTurns}
          onChange={(e) => onUpdate({ maxTurns: parseInt(e.target.value, 10) || 10 })}
          min={1}
          max={50}
          className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-1.5 rounded-md gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        <Save className="h-3.5 w-3.5" />
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

// ── Add Step Form ──

function AddStepForm({ onAdd, onCancel, totalSteps }: { onAdd: (title: string, shortTitle: string, insertAt?: number) => void; onCancel: () => void; totalSteps: number }) {
  const [title, setTitle] = useState("");
  const [shortTitle, setShortTitle] = useState("");
  const [position, setPosition] = useState(totalSteps + 1);

  return (
    <div className="max-w-lg space-y-4">
      <h2 className="text-lg font-bold">Add New Step</h2>
      <div>
        <label className="block text-sm font-medium mb-1">Title (the question)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. What is the customer's buying journey?"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Short Title</label>
        <input
          type="text"
          value={shortTitle}
          onChange={(e) => setShortTitle(e.target.value)}
          placeholder="e.g. Buying Journey"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Position</label>
        <p className="text-xs text-muted-foreground mb-2">
          Insert at this step number. Existing steps at and after this position will shift down.
        </p>
        <select
          value={position}
          onChange={(e) => setPosition(parseInt(e.target.value, 10))}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {Array.from({ length: totalSteps + 1 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              Step {n} {n === totalSteps + 1 ? "(end)" : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => { if (title.trim() && shortTitle.trim()) onAdd(title.trim(), shortTitle.trim(), position); }}
          disabled={!title.trim() || !shortTitle.trim()}
          className="rounded-md gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Add Step
        </button>
        <button onClick={onCancel} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
      </div>
    </div>
  );
}

// ── Briefing Sidebar ──

function BriefingSidebar({ categories }: { categories: BriefingCategoryData[] }) {
  const enabledQuestions = categories.filter((c) => c.enabled).reduce((sum, c) => sum + c.questions.filter((q) => q.enabled).length, 0);
  const totalQuestions = categories.reduce((sum, c) => sum + c.questions.length, 0);
  return (
    <div className="space-y-2">
      <div className="px-2 text-xs text-muted-foreground">{enabledQuestions} / {totalQuestions} questions active</div>
      {categories.map((cat) => (
        <div key={cat.id} className="flex items-center gap-1.5 px-2 py-1 text-xs">
          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cat.enabled ? "bg-green-500" : "bg-muted-foreground/30")} />
          <span className={cn("truncate", !cat.enabled && "text-muted-foreground line-through")}>{cat.label}</span>
          <span className="ml-auto text-[10px] text-muted-foreground">{cat.questions.filter((q) => q.enabled).length}</span>
        </div>
      ))}
    </div>
  );
}

// ── Briefing Template Editor (unchanged logic, keeping it inline) ──

function BriefingTemplateEditor({ categories, onRefresh }: { categories: BriefingCategoryData[]; onRefresh: () => void }) {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [addingQuestionTo, setAddingQuestionTo] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [editQuestionText, setEditQuestionText] = useState("");
  const [editingCatLabel, setEditingCatLabel] = useState<string | null>(null);
  const [editCatText, setEditCatText] = useState("");

  function toggleCat(id: string) { setExpandedCats((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  async function addCategory() { if (!newCatLabel.trim()) return; await fetch("/api/admin/briefing-template/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: newCatLabel.trim() }) }); setNewCatLabel(""); setAddingCategory(false); onRefresh(); }
  async function toggleCategoryEnabled(cat: BriefingCategoryData) { await fetch(`/api/admin/briefing-template/categories/${cat.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !cat.enabled }) }); onRefresh(); }
  async function saveCatLabel(catId: string) { if (!editCatText.trim()) return; await fetch(`/api/admin/briefing-template/categories/${catId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: editCatText.trim() }) }); setEditingCatLabel(null); onRefresh(); }
  async function deleteCategory(catId: string) { if (!confirm("Delete this category and all its questions?")) return; await fetch(`/api/admin/briefing-template/categories/${catId}`, { method: "DELETE" }); onRefresh(); }
  async function addQuestionToCategory(catId: string) { if (!newQuestion.trim()) return; await fetch(`/api/admin/briefing-template/categories/${catId}/questions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: newQuestion.trim() }) }); setNewQuestion(""); setAddingQuestionTo(null); onRefresh(); }
  async function toggleQuestionEnabled(catId: string, q: BriefingQuestionData) { await fetch(`/api/admin/briefing-template/categories/${catId}/questions/${q.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !q.enabled }) }); onRefresh(); }
  async function saveQuestionText(catId: string, qId: string) { if (!editQuestionText.trim()) return; await fetch(`/api/admin/briefing-template/categories/${catId}/questions/${qId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: editQuestionText.trim() }) }); setEditingQuestion(null); onRefresh(); }
  async function deleteQuestion(catId: string, qId: string) { await fetch(`/api/admin/briefing-template/categories/${catId}/questions/${qId}`, { method: "DELETE" }); onRefresh(); }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" /> Briefing Template</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure which briefing questions the AI assesses against your program context.</p>
      </div>
      <div className="space-y-2">
        {categories.map((cat) => {
          const isExpanded = expandedCats.has(cat.id);
          const activeQs = cat.questions.filter((q) => q.enabled).length;
          return (
            <div key={cat.id} className={cn("rounded-lg border border-border overflow-hidden", !cat.enabled && "opacity-60")}>
              <div className="flex items-center gap-2 px-4 py-3 bg-card">
                <button onClick={() => toggleCat(cat.id)} className="flex-1 flex items-center gap-2 text-left min-w-0">
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                  {editingCatLabel === cat.id ? (
                    <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                      <input type="text" value={editCatText} onChange={(e) => setEditCatText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveCatLabel(cat.id); if (e.key === "Escape") setEditingCatLabel(null); }} className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-ring" autoFocus />
                      <button onClick={() => saveCatLabel(cat.id)} className="p-0.5"><Check className="h-3.5 w-3.5 text-primary" /></button>
                      <button onClick={() => setEditingCatLabel(null)} className="p-0.5"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    </div>
                  ) : <span className="text-sm font-semibold truncate">{cat.label}</span>}
                </button>
                <span className="text-xs text-muted-foreground shrink-0">{activeQs}/{cat.questions.length}</span>
                <button onClick={(e) => { e.stopPropagation(); setEditingCatLabel(cat.id); setEditCatText(cat.label); }} className="p-1 hover:bg-secondary rounded text-muted-foreground"><Pencil className="h-3 w-3" /></button>
                <button onClick={(e) => { e.stopPropagation(); toggleCategoryEnabled(cat); }} className="p-1 hover:bg-secondary rounded">{cat.enabled ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}</button>
                <button onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id); }} className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              </div>
              {isExpanded && (
                <div className="border-t border-border divide-y divide-border">
                  {cat.questions.map((q) => (
                    <div key={q.id} className={cn("group flex items-start gap-2 px-4 py-2.5", !q.enabled && "opacity-50")}>
                      <button onClick={() => toggleQuestionEnabled(cat.id, q)} className="mt-0.5 shrink-0">{q.enabled ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}</button>
                      {editingQuestion === q.id ? (
                        <div className="flex-1 flex items-center gap-1">
                          <input type="text" value={editQuestionText} onChange={(e) => setEditQuestionText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveQuestionText(cat.id, q.id); if (e.key === "Escape") setEditingQuestion(null); }} className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring" autoFocus />
                          <button onClick={() => saveQuestionText(cat.id, q.id)} className="p-0.5"><Check className="h-3 w-3 text-primary" /></button>
                          <button onClick={() => setEditingQuestion(null)} className="p-0.5"><X className="h-3 w-3 text-muted-foreground" /></button>
                        </div>
                      ) : (
                        <>
                          <span className={cn("flex-1 text-xs leading-relaxed", !q.enabled && "line-through")}>{q.question}</span>
                          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingQuestion(q.id); setEditQuestionText(q.question); }} className="p-0.5 hover:bg-secondary rounded"><Pencil className="h-3 w-3 text-muted-foreground" /></button>
                            <button onClick={() => deleteQuestion(cat.id, q.id)} className="p-0.5 hover:bg-secondary rounded"><Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" /></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  <div className="px-4 py-2.5">
                    {addingQuestionTo === cat.id ? (
                      <div className="flex items-center gap-1">
                        <input type="text" value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addQuestionToCategory(cat.id); if (e.key === "Escape") setAddingQuestionTo(null); }} placeholder="Type a new question..." className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring" autoFocus />
                        <button onClick={() => addQuestionToCategory(cat.id)} disabled={!newQuestion.trim()} className="rounded bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-primary disabled:opacity-50">Add</button>
                        <button onClick={() => { setAddingQuestionTo(null); setNewQuestion(""); }} className="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-secondary">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setAddingQuestionTo(cat.id)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><Plus className="h-3 w-3" /> Add question</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {addingCategory ? (
        <div className="rounded-lg border border-dashed border-border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <input type="text" value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCategory(); if (e.key === "Escape") setAddingCategory(false); }} placeholder="Category name..." className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" autoFocus />
            <button onClick={addCategory} disabled={!newCatLabel.trim()} className="rounded-md gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">Add</button>
            <button onClick={() => { setAddingCategory(false); setNewCatLabel(""); }} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAddingCategory(true)} className="flex items-center gap-1.5 rounded-md border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors w-full justify-center">
          <Plus className="h-4 w-4" /> Add Category
        </button>
      )}
    </div>
  );
}

// ── Research Agent Editor ──

const RESEARCH_TOOLS = ["WebSearch", "WebFetch", "Read", "Glob", "Grep"];

function ResearchAgentEditor({
  agent,
  onSave,
  saving,
}: {
  agent: ResearchAgentData;
  onSave: (updated: Partial<ResearchAgentData> & { id: string }) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(agent);

  // Reset form when agent changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setForm(agent); }, [agent.id]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Search className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">{form.name}</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Assessment area: <span className="font-medium text-foreground">{form.category.label}</span>
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Agent Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Research Instructions</label>
        <p className="text-xs text-muted-foreground mb-2">
          System prompt that guides the AI when researching this area. Be specific about what to look for, what sources to prioritize, and how to structure findings.
        </p>
        <textarea
          value={form.instructions}
          onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          rows={16}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y font-mono"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Allowed Tools</label>
        <div className="flex flex-wrap gap-2">
          {RESEARCH_TOOLS.map((tool) => {
            const checked = form.allowedTools.includes(tool);
            return (
              <label
                key={tool}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs cursor-pointer",
                  checked ? "border-primary/40 bg-primary/10 text-primary" : "border-border hover:bg-secondary"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...form.allowedTools, tool]
                      : form.allowedTools.filter((t) => t !== tool);
                    setForm({ ...form, allowedTools: next });
                  }}
                  className="sr-only"
                />
                {tool}
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Max Turns</label>
        <input
          type="number"
          value={form.maxTurns}
          onChange={(e) => setForm({ ...form, maxTurns: parseInt(e.target.value, 10) || 10 })}
          min={1}
          max={50}
          className="w-24 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <button
        onClick={() => onSave({
          id: form.id,
          name: form.name,
          instructions: form.instructions,
          allowedTools: form.allowedTools,
          maxTurns: form.maxTurns,
        })}
        disabled={saving}
        className="flex items-center gap-1.5 rounded-md gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        <Save className="h-3.5 w-3.5" />
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
