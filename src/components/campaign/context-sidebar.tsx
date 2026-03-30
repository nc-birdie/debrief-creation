"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Layers, BookOpen } from "lucide-react";
import type { KnowledgeEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProgramContext } from "./program-context";

interface ContextSidebarProps {
  campaignId: string;
  knowledgeEntries: KnowledgeEntry[];
  dependentOutputs: Array<{
    stepNumber: number;
    title: string;
    output: string;
  }>;
  onRefresh: () => void;
}

export function ContextSidebar({
  campaignId,
  knowledgeEntries,
  dependentOutputs,
  onRefresh,
}: ContextSidebarProps) {
  return (
    <aside className="w-72 shrink-0 border-l border-border bg-sidebar overflow-y-auto">
      <div className="p-3 space-y-4">
        {/* Prior step outputs */}
        {dependentOutputs.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
              <Layers className="h-3 w-3" />
              Feeds Into This Step
            </h3>
            <div className="space-y-1">
              {dependentOutputs.map((dep) => (
                <CollapsibleCard
                  key={dep.stepNumber}
                  title={`Step ${dep.stepNumber}: ${dep.title}`}
                  content={dep.output}
                  accent
                />
              ))}
            </div>
          </section>
        )}

        {/* Program Context */}
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5">
            <BookOpen className="h-3 w-3" />
            Program Context ({knowledgeEntries.length})
          </h3>
          <ProgramContext
            campaignId={campaignId}
            entries={knowledgeEntries}
            onRefresh={onRefresh}
            compact
          />
        </section>
      </div>
    </aside>
  );
}

function CollapsibleCard({
  title,
  content,
  accent,
}: {
  title: string;
  content: string;
  accent?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "rounded-md border border-border",
        accent && "border-primary/20"
      )}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-2.5 py-2 text-left"
      >
        <span className="text-xs font-medium truncate">{title}</span>
        {open ? (
          <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
          {content.length > 800 ? content.slice(0, 800) + "..." : content}
        </div>
      )}
    </div>
  );
}
