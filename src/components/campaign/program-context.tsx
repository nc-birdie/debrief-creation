"use client";

import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Pencil,
  FileText,
  BookOpen,
} from "lucide-react";
import type { KnowledgeEntry } from "@/lib/types";
import { KNOWLEDGE_AREAS } from "@/lib/knowledge-areas";
import { cn } from "@/lib/utils";

interface ProgramContextProps {
  campaignId: string;
  entries: KnowledgeEntry[];
  onRefresh: () => void;
  compact?: boolean;
}

export function ProgramContext({
  campaignId,
  entries,
  onRefresh,
  compact,
}: ProgramContextProps) {
  const [addingTo, setAddingTo] = useState<string | null>(null);

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
  const emptyAreas = KNOWLEDGE_AREAS.filter(
    (a) => (grouped.get(a.id)?.length ?? 0) === 0
  );

  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic px-1 py-4 text-center">
        No knowledge extracted yet. Ingest your sources to populate the program
        context.
      </p>
    );
  }

  // Compact mode for sidebar — keep the old stacked list
  if (compact) {
    return (
      <CompactContext
        campaignId={campaignId}
        entries={entries}
        grouped={grouped}
        areasWithEntries={areasWithEntries}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <BookOpen className="h-4 w-4 text-primary" />
          Program Context
          <span className="text-xs font-normal text-muted-foreground">
            ({entries.length} entries across {areasWithEntries.length} areas)
          </span>
        </h3>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {areasWithEntries.map((area) => (
          <AreaCard
            key={area.id}
            area={area}
            entries={grouped.get(area.id) ?? []}
            campaignId={campaignId}
            onRefresh={onRefresh}
            addingTo={addingTo}
            setAddingTo={setAddingTo}
          />
        ))}
      </div>

      {/* Add to empty area */}
      {emptyAreas.length > 0 && (
        <AddToAreaDropdown
          areas={emptyAreas}
          campaignId={campaignId}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

// ── Area Card ──

function AreaCard({
  area,
  entries,
  campaignId,
  onRefresh,
  addingTo,
  setAddingTo,
}: {
  area: { id: string; label: string };
  entries: KnowledgeEntry[];
  campaignId: string;
  onRefresh: () => void;
  addingTo: string | null;
  setAddingTo: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card flex flex-col">
      {/* Card header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate">{area.label}</span>
          <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium shrink-0">
            {entries.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Collapsed preview: show first 3 entry titles */}
      {!expanded && entries.length > 0 && (
        <div className="px-4 pb-3 space-y-1">
          {entries.slice(0, 3).map((e) => (
            <div
              key={e.id}
              className="text-xs text-muted-foreground truncate flex items-center gap-1.5"
            >
              <span className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
              <span className="truncate">{e.title}</span>
            </div>
          ))}
          {entries.length > 3 && (
            <div className="text-[10px] text-muted-foreground/60 pl-2.5">
              +{entries.length - 3} more
            </div>
          )}
        </div>
      )}

      {/* Expanded: full entry list */}
      {expanded && (
        <div className="border-t border-border max-h-[400px] overflow-y-auto">
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              campaignId={campaignId}
              onRefresh={onRefresh}
            />
          ))}
          <div className="px-4 py-2.5 border-t border-border">
            {addingTo === area.id ? (
              <AddEntryForm
                campaignId={campaignId}
                area={area.id}
                onDone={() => {
                  setAddingTo(null);
                  onRefresh();
                }}
                onCancel={() => setAddingTo(null)}
              />
            ) : (
              <button
                onClick={() => setAddingTo(area.id)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              >
                <Plus className="h-3 w-3" />
                Add entry
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Compact sidebar version ──

function CompactContext({
  campaignId,
  entries,
  grouped,
  areasWithEntries,
  onRefresh,
}: {
  campaignId: string;
  entries: KnowledgeEntry[];
  grouped: Map<string, KnowledgeEntry[]>;
  areasWithEntries: Array<{ id: string; label: string }>;
  onRefresh: () => void;
}) {
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());

  function toggleArea(id: string) {
    setExpandedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-1">
      {areasWithEntries.map((area) => {
        const areaEntries = grouped.get(area.id) ?? [];
        const isExpanded = expandedAreas.has(area.id);
        return (
          <div key={area.id} className="rounded-md border border-border">
            <button
              onClick={() => toggleArea(area.id)}
              className="w-full flex items-center justify-between px-2.5 py-2 text-left hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-semibold truncate">
                  {area.label}
                </span>
                <span className="rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium">
                  {areaEntries.length}
                </span>
              </div>
              {isExpanded ? (
                <ChevronUp className="h-3 w-3 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
            </button>
            {isExpanded && (
              <div className="border-t border-border">
                {areaEntries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    campaignId={campaignId}
                    onRefresh={onRefresh}
                    compact
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Entry Row ──

function EntryRow({
  entry,
  campaignId,
  onRefresh,
  compact,
}: {
  entry: KnowledgeEntry;
  campaignId: string;
  onRefresh: () => void;
  compact?: boolean;
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
      <div className="px-4 py-2.5 border-t border-border space-y-2">
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={4}
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-y"
        />
        <div className="flex gap-1">
          <button
            onClick={saveEdit}
            className="rounded bg-green-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-green-700"
          >
            Save
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setEditTitle(entry.title);
              setEditContent(entry.content);
            }}
            className="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group px-4 py-2.5 border-t border-border hover:bg-secondary/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left min-w-0"
        >
          <span
            className={cn("font-medium", compact ? "text-[11px]" : "text-xs")}
          >
            {entry.title}
          </span>
          {entry.sourceName && (
            <span className="ml-1.5 text-[10px] text-muted-foreground/50 font-normal">
              {entry.sourceName}
            </span>
          )}
        </button>
        {!compact && (
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => setEditing(true)}
              className="p-0.5 hover:bg-secondary rounded"
            >
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
            <button
              onClick={deleteEntry}
              className="p-0.5 hover:bg-secondary rounded"
            >
              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        )}
      </div>
      {expanded && (
        <div className="mt-1.5 space-y-1">
          <p
            className={cn(
              "text-muted-foreground leading-relaxed whitespace-pre-wrap",
              compact ? "text-[10px]" : "text-xs"
            )}
          >
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

// ── Add Entry Form ──

function AddEntryForm({
  campaignId,
  area,
  onDone,
  onCancel,
}: {
  campaignId: string;
  area: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  async function submit() {
    if (!title.trim() || !content.trim()) return;
    await fetch(`/api/campaigns/${campaignId}/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area, title: title.trim(), content: content.trim() }),
    });
    onDone();
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Entry title..."
        className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        autoFocus
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Content — be specific and detailed..."
        rows={3}
        className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-y"
      />
      <div className="flex gap-1">
        <button
          onClick={submit}
          disabled={!title.trim() || !content.trim()}
          className="rounded bg-green-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Add
        </button>
        <button
          onClick={onCancel}
          className="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Add to Empty Area ──

function AddToAreaDropdown({
  areas,
  campaignId,
  onRefresh,
}: {
  areas: Array<{ id: string; label: string }>;
  campaignId: string;
  onRefresh: () => void;
}) {
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  if (selectedArea) {
    const area = areas.find((a) => a.id === selectedArea);
    return (
      <div className="rounded-md border border-dashed border-border p-3">
        <div className="text-xs font-medium mb-2">Add to: {area?.label}</div>
        <AddEntryForm
          campaignId={campaignId}
          area={selectedArea}
          onDone={() => {
            setSelectedArea(null);
            onRefresh();
          }}
          onCancel={() => setSelectedArea(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground">Add to:</span>
      {areas.map((area) => (
        <button
          key={area.id}
          onClick={() => setSelectedArea(area.id)}
          className="rounded-md border border-dashed border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          {area.label}
        </button>
      ))}
    </div>
  );
}
