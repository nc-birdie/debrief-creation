"use client";

import { useState, useRef } from "react";
import {
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
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Source } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ACCEPTED_EXTENSIONS, SUPPORTED_TYPES_LABEL } from "@/lib/file-types";

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

interface SourcesManagerProps {
  campaignId: string;
  sources: Source[];
  onRefresh: () => void;
}

export function SourcesManager({
  campaignId,
  sources,
  onRefresh,
}: SourcesManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(sources.length === 0);
  const [ingestingSource, setIngestingSource] = useState<string | null>(null);
  const [ingestingAll, setIngestingAll] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual path / folder input
  const [showManual, setShowManual] = useState(false);
  const [manualPath, setManualPath] = useState("");
  const [manualName, setManualName] = useState("");
  const [isFolder, setIsFolder] = useState(false);
  const [addingManual, setAddingManual] = useState(false);

  const ingestedCount = sources.filter((s) => s.ingested).length;

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
        await onRefresh();
        setExpanded(true);
      }
    } catch {
      setError("Upload failed");
    }
    setUploading(false);
  }

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
        await onRefresh();
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
    onRefresh();
  }

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
    await onRefresh();
    setIngestingSource(null);
  }

  async function ingestAll() {
    setIngestingAll(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/ingest`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        const failed = data.results?.filter(
          (r: { status: string }) => r.status === "failed"
        );
        if (failed?.length) {
          setError(
            failed
              .map(
                (f: { name: string; error?: string }) =>
                  `${f.name}: ${f.error || "Failed"}`
              )
              .join(". ")
          );
        }
      }
    } catch {
      setError("Ingestion failed");
    }
    await onRefresh();
    setIngestingAll(false);
  }

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

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary shrink-0">
            <Upload className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Source Documents</h3>
              {sources.length > 0 && (
                <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">
                  {ingestedCount} / {sources.length} ingested
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Upload documents to extract knowledge. Supports {SUPPORTED_TYPES_LABEL}.
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-5 py-5 space-y-4">
          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm text-destructive flex-1">{error}</div>
              <button
                onClick={() => setError(null)}
                className="text-destructive/60 hover:text-destructive text-xs"
              >
                dismiss
              </button>
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
              "rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
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
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
                <p className="text-sm font-medium">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <Upload className="h-6 w-6 text-muted-foreground/50" />
                <p className="text-sm font-medium">
                  Drop files here or click to browse
                </p>
              </div>
            )}
          </div>

          {/* Alt add methods */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowManual(true);
                setIsFolder(false);
              }}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add by File Path
            </button>
            <button
              onClick={() => {
                setShowManual(true);
                setIsFolder(true);
              }}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors"
            >
              <FolderOpen className="h-3 w-3" />
              Import Folder
            </button>
          </div>

          {/* Manual path form */}
          {showManual && (
            <div className="rounded-lg border border-border bg-secondary/10 p-4">
              <h4 className="text-xs font-semibold mb-3 flex items-center gap-2">
                {isFolder ? (
                  <>
                    <FolderOpen className="h-3.5 w-3.5 text-primary" /> Import
                    Folder
                  </>
                ) : (
                  <>
                    <FileText className="h-3.5 w-3.5 text-primary" /> Add by
                    File Path
                  </>
                )}
              </h4>
              <form onSubmit={addManualSource} className="space-y-3">
                <input
                  type="text"
                  value={manualPath}
                  onChange={(e) => setManualPath(e.target.value)}
                  placeholder={
                    isFolder
                      ? "C:\\path\\to\\documents\\"
                      : "C:\\path\\to\\document.pdf"
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  autoFocus
                />
                {isFolder && (
                  <p className="text-[10px] text-muted-foreground">
                    Scans up to 3 levels deep. Skips node_modules, .git, etc.
                  </p>
                )}
                {!isFolder && (
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Display Name (optional)"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={addingManual || !manualPath.trim()}
                    className="flex items-center gap-1.5 rounded-md gradient-bg px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {addingManual && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    {isFolder ? "Scan & Import" : "Add Source"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManual(false)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Source list */}
          {sources.length > 0 && (
            <div className="rounded-lg border border-border">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/20">
                <span className="text-xs font-semibold">
                  Sources ({sources.length})
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
                      ? "Ingesting..."
                      : `Ingest All (${sources.length - ingestedCount})`}
                  </button>
                )}
              </div>
              <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                {sources.map((s) => {
                  const Icon = FILE_TYPE_ICONS[s.fileType] ?? FileText;
                  const isIngesting = ingestingSource === s.id;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/20 transition-colors"
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium truncate">
                            {s.name}
                          </span>
                          <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {s.fileType}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatBytes(s.sizeBytes)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {s.ingested ? (
                          <span className="flex items-center gap-1 text-[10px] text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Ingested
                          </span>
                        ) : (
                          <button
                            onClick={() => ingestSource(s.id)}
                            disabled={isIngesting}
                            className="flex items-center gap-1 rounded-md gradient-bg px-2.5 py-0.5 text-[10px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {isIngesting ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-2.5 w-2.5" />
                            )}
                            {isIngesting ? "Ingesting..." : "Ingest"}
                          </button>
                        )}
                        <button
                          onClick={() => removeSource(s.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
