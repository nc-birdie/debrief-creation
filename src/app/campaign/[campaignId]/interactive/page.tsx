"use client";

import { useEffect, useId, useState, useRef, useMemo, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bird,
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  Download,
  Lightbulb,
  Loader2,
  RefreshCw,
  Send,
  AlertTriangle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Block types ─────────────────────────────────────────────────────── */

interface HeroBlock { type: "hero"; title: string; subtitle: string; abstract: string; sourceSteps?: number[] }
interface ChapterBlock { type: "chapter"; number: number; title: string; subtitle?: string; sourceSteps?: number[] }
interface ProseBlock { type: "prose"; content: string; sourceSteps?: number[] }
interface StatsBlock { type: "stats"; items: { value: string; label: string; description?: string }[]; sourceSteps?: number[] }
interface CardsBlock { type: "cards"; columns?: 2 | 3; items: { title: string; content: string }[]; sourceSteps?: number[] }
interface QuoteBlock { type: "quote"; text: string; attribution?: string; sourceSteps?: number[] }
interface TwoColumnBlock { type: "two-column"; left: { title: string; content: string }; right: { title: string; content: string }; sourceSteps?: number[] }
interface CalloutBlock { type: "callout"; title: string; content: string; variant: "insight" | "warning" | "opportunity"; sourceSteps?: number[] }
interface TableBlock { type: "table"; caption?: string; headers: string[]; rows: string[][]; sourceSteps?: number[] }
interface ListBlock { type: "list"; title: string; variant: "numbered" | "check" | "arrow"; items: { title: string; description?: string }[]; sourceSteps?: number[] }
interface DividerBlock { type: "divider"; sourceSteps?: number[] }
interface AccordionBlock { type: "accordion"; title: string; items: { title: string; content: string; badge?: string; open?: boolean }[]; sourceSteps?: number[] }
interface ScoredListBlock { type: "scored-list"; title: string; items: { score: string | number; label: string; sublabel?: string; badge?: string; variant?: "red" | "orange" | "green" }[]; sourceSteps?: number[] }
interface SegmentCardsBlock { type: "segment-cards"; items: { tier: string; name: string; message: string; metrics: Record<string, string> }[]; sourceSteps?: number[] }
interface TimelineBlock { type: "timeline"; title: string; periods: { label: string; status: "past" | "current" | "future"; items: { text: string; badge?: string; variant?: "red" | "orange" | "green" }[] }[]; sourceSteps?: number[] }
interface TabsBlock { type: "tabs"; tabs: { label: string; items: { title: string; content: string }[] }[]; sourceSteps?: number[] }
interface DirectionCardsBlock { type: "direction-cards"; items: { segment: string; get: string; to: string; by: string; target?: string; priority?: string }[]; sourceSteps?: number[] }
interface ComparisonBlock { type: "comparison"; items: { name: string; badge?: string; fields: Record<string, string> }[]; sourceSteps?: number[] }
interface PhasesBlock { type: "phases"; items: { label: string; sublabel?: string; description?: string }[]; sourceSteps?: number[] }

type Block = HeroBlock | ChapterBlock | ProseBlock | StatsBlock | CardsBlock | QuoteBlock | TwoColumnBlock | CalloutBlock | TableBlock | ListBlock | DividerBlock | AccordionBlock | ScoredListBlock | SegmentCardsBlock | TimelineBlock | TabsBlock | DirectionCardsBlock | ComparisonBlock | PhasesBlock;

interface Design { campaignName: string; generatedAt: string; blocks: Block[] }
interface ChatMessage { role: "user" | "assistant"; content: string }
interface SectionChange { blockIndex: number; reason: string; updatedBlock: Block }
interface PendingRipple { sectionChanges: SectionChange[]; summary: string }

/* ── Derive chapters from blocks ─────────────────────────────────────── */

interface Chapter {
  title: string;
  subtitle?: string;
  number: number;
  /** Indices into blocks[] that belong to this chapter */
  blockIndices: number[];
}

function deriveChapters(blocks: Block[]): Chapter[] {
  const chapters: Chapter[] = [];

  // Blocks before the first chapter block go into a virtual "intro" chapter
  let currentChapter: Chapter | null = null;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === "hero") {
      // Hero is always standalone, add to intro or its own
      if (!currentChapter) {
        currentChapter = { title: "Introduction", number: 0, blockIndices: [] };
        chapters.push(currentChapter);
      }
      currentChapter.blockIndices.push(i);
    } else if (block.type === "chapter") {
      currentChapter = {
        title: block.title,
        subtitle: block.subtitle,
        number: block.number,
        blockIndices: [i],
      };
      chapters.push(currentChapter);
    } else {
      if (!currentChapter) {
        currentChapter = { title: "Introduction", number: 0, blockIndices: [] };
        chapters.push(currentChapter);
      }
      currentChapter.blockIndices.push(i);
    }
  }

  return chapters;
}

/* ── Main page ───────────────────────────────────────────────────────── */

export default function InteractivePage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = use(params);
  const [design, setDesign] = useState<Design | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Navigation
  const [activeChapterIdx, setActiveChapterIdx] = useState<number | null>(null);

  // Chat sidebar
  const [activeBlockIdx, setActiveBlockIdx] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [refining, setRefining] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Ripple
  const [pendingRipple, setPendingRipple] = useState<PendingRipple | null>(null);
  const [applyingRipple, setApplyingRipple] = useState(false);
  const [rippleHighlights, setRippleHighlights] = useState<Set<number>>(new Set());

  const chapters = useMemo(
    () => (design ? deriveChapters(design.blocks) : []),
    [design]
  );

  useEffect(() => { fetchDesign(); }, [campaignId]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, pendingRipple]);
  useEffect(() => { if (activeBlockIdx !== null && !pendingRipple) inputRef.current?.focus(); }, [activeBlockIdx, pendingRipple]);

  async function fetchDesign() {
    setLoading(true);
    const res = await fetch(`/api/campaigns/${campaignId}/interactive-design`);
    if (res.ok) {
      const data = await res.json();
      if (data.design) setDesign(data.design);
    }
    setLoading(false);
  }

  async function generateDesign() {
    setGenerating(true);
    const res = await fetch(`/api/campaigns/${campaignId}/interactive-design`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setDesign(data.design);
    }
    setGenerating(false);
  }

  function openChat(idx: number) {
    setActiveBlockIdx(idx);
    setChatMessages([]);
    setChatInput("");
    setPendingRipple(null);
  }

  function closeChat() {
    setActiveBlockIdx(null);
    setChatMessages([]);
    setChatInput("");
    setPendingRipple(null);
  }

  async function sendMessage() {
    if (!chatInput.trim() || activeBlockIdx === null || refining || !design) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setPendingRipple(null);
    setRefining(true);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/refine-section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "refine-block",
          blockIndex: activeBlockIdx,
          block: design.blocks[activeBlockIdx],
          userMessage: userMsg,
          allBlocks: design.blocks,
        }),
      });

      if (!res.ok) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
        setRefining(false);
        return;
      }

      const data = await res.json();
      setDesign((prev) => {
        if (!prev) return prev;
        const blocks = [...prev.blocks];
        blocks[activeBlockIdx] = data.updatedBlock;
        return { ...prev, blocks };
      });
      setRefining(false);

      const ripple = data.ripple as PendingRipple | undefined;
      if (ripple && (ripple.sectionChanges?.length ?? 0) > 0) {
        setPendingRipple(ripple);
        setChatMessages((prev) => [...prev, { role: "assistant", content: `Updated. ${ripple.summary}` }]);
      } else {
        setChatMessages((prev) => [...prev, { role: "assistant", content: "Updated. No changes needed elsewhere." }]);
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Connection error. Try again." }]);
      setRefining(false);
    }
  }

  async function applyRippleChanges() {
    if (!pendingRipple || !design) return;
    setApplyingRipple(true);
    const changedIdxs = new Set<number>();

    setDesign((prev) => {
      if (!prev) return prev;
      const blocks = [...prev.blocks];
      for (const change of pendingRipple.sectionChanges) {
        if (change.blockIndex >= 0 && change.blockIndex < blocks.length) {
          blocks[change.blockIndex] = change.updatedBlock;
          changedIdxs.add(change.blockIndex);
        }
      }
      return { ...prev, blocks };
    });

    await fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interactiveDesign: JSON.stringify(design) }),
    }).catch(() => {});

    setChatMessages((prev) => [...prev, { role: "assistant", content: `Applied ${pendingRipple.sectionChanges.length} update(s).` }]);
    setRippleHighlights(changedIdxs);
    setTimeout(() => setRippleHighlights(new Set()), 3000);
    setPendingRipple(null);
    setApplyingRipple(false);
  }

  function dismissRipple() {
    setPendingRipple(null);
    setChatMessages((prev) => [...prev, { role: "assistant", content: "Dismissed. Only the direct edit was applied." }]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  async function handleExport() {
    if (!design) return;
    const lines = [`# ${design.campaignName}`, "", `> Interactive Review Export`, "", "---", ""];
    for (const block of design.blocks) { lines.push(blockToMarkdown(block)); lines.push(""); }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${design.campaignName.toLowerCase().replace(/\s+/g, "-")}-interactive.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── Loading state ──────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        Loading...
      </div>
    );
  }

  /* ── Generate state (no design yet) ─────────────────────────────────── */

  if (!design) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-bg">
          <Bird className="h-8 w-8 text-white" />
        </div>
        <div className="text-center max-w-md">
          <h1 className="text-xl font-bold mb-2">Interactive Review</h1>
          <p className="text-sm text-muted-foreground">
            Birdie will read all your step outputs and design an immersive,
            chapter-based reading experience tailored to this campaign.
          </p>
        </div>
        <button
          onClick={generateDesign}
          disabled={generating}
          className="flex items-center gap-2 rounded-lg gradient-bg px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {generating ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Designing your experience...</>
          ) : (
            <><Bird className="h-4 w-4" />Create Interactive Experience</>
          )}
        </button>
        {generating && (
          <p className="text-xs text-muted-foreground">This can take 5–15 minutes</p>
        )}
        <Link href={`/campaign/${campaignId}`} className="text-xs text-muted-foreground hover:text-foreground">
          Back to workspace
        </Link>
      </div>
    );
  }

  /* ── Table of contents (no chapter selected) ────────────────────────── */

  const heroBlock = design.blocks.find((b) => b.type === "hero") as HeroBlock | undefined;
  const contentChapters = chapters.filter((c) => c.number > 0);

  if (activeChapterIdx === null) {
    return (
      <div className="flex flex-col min-h-screen">
        {/* Hero header */}
        <div className="relative overflow-hidden gradient-bg px-8 py-16 md:px-16 md:py-24 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.08),transparent_60%)]" />
          <div className="relative max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <Link
                href={`/campaign/${campaignId}`}
                className="flex items-center gap-1 text-xs text-white/60 hover:text-white/90"
              >
                <ArrowLeft className="h-3 w-3" />
                Workspace
              </Link>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
              {heroBlock?.title || design.campaignName}
            </h1>
            <p className="text-lg md:text-xl font-light opacity-90 mb-4">
              {heroBlock?.subtitle || "Campaign Direction"}
            </p>
            {heroBlock?.abstract && (
              <p className="text-sm opacity-70 leading-relaxed max-w-xl">
                {heroBlock.abstract}
              </p>
            )}
          </div>
        </div>

        {/* Chapter grid */}
        <div className="flex-1 bg-background">
          <div className="max-w-3xl mx-auto px-8 md:px-16 py-12">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-lg font-bold">Chapters</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {contentChapters.length} chapters to explore
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={generateDesign}
                  disabled={generating}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary"
                >
                  <RefreshCw className={cn("h-3 w-3", generating && "animate-spin")} />
                  Redesign
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary"
                >
                  <Download className="h-3 w-3" />
                  Export
                </button>
              </div>
            </div>

            {/* Start reading CTA */}
            {contentChapters.length > 0 && (
              <button
                onClick={() => setActiveChapterIdx(0)}
                className="w-full mb-6 flex items-center justify-between rounded-xl gradient-bg px-6 py-4 text-white hover:opacity-90 transition-opacity group"
              >
                <div className="text-left">
                  <p className="text-sm font-semibold">Start reading</p>
                  <p className="text-xs opacity-75 mt-0.5">
                    Begin with Chapter 1: {contentChapters[0]?.title}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 opacity-70 group-hover:translate-x-1 transition-transform" />
              </button>
            )}

            {/* Chapter cards */}
            <div className="space-y-3">
              {contentChapters.map((chapter, idx) => {
                // Count content blocks (non-chapter, non-divider)
                const contentCount = chapter.blockIndices.filter(
                  (bi) => design.blocks[bi].type !== "chapter" && design.blocks[bi].type !== "divider"
                ).length;

                return (
                  <button
                    key={chapter.number}
                    onClick={() => setActiveChapterIdx(idx)}
                    className="w-full flex items-center gap-4 rounded-xl border border-border bg-card p-5 hover:border-primary/30 hover:bg-primary/[0.02] transition-all text-left group"
                  >
                    <span className="flex items-center justify-center h-10 w-10 rounded-xl gradient-bg text-white text-sm font-bold shrink-0">
                      {chapter.number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold">{chapter.title}</h3>
                      {chapter.subtitle && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {chapter.subtitle}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {contentCount} section{contentCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Chapter view ───────────────────────────────────────────────────── */

  const currentChapter = contentChapters[activeChapterIdx];
  const prevChapter = activeChapterIdx > 0 ? contentChapters[activeChapterIdx - 1] : null;
  const nextChapter = activeChapterIdx < contentChapters.length - 1 ? contentChapters[activeChapterIdx + 1] : null;

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="glass shrink-0 px-4 py-3 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setActiveChapterIdx(null); closeChat(); }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div className="flex h-6 w-6 items-center justify-center rounded gradient-bg">
            <Bird className="h-3 w-3 text-white" />
          </div>
          <span className="text-sm font-semibold">{design.campaignName}</span>
          <span className="text-[10px] text-muted-foreground">
            Chapter {currentChapter.number} of {contentChapters.length}
          </span>

          {/* Chapter dots */}
          <div className="flex items-center gap-1 ml-2">
            {contentChapters.map((_, idx) => (
              <button
                key={idx}
                onClick={() => { setActiveChapterIdx(idx); closeChat(); }}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  idx === activeChapterIdx
                    ? "w-6 gradient-bg"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
                title={contentChapters[idx].title}
              />
            ))}
          </div>

          <div className="flex-1" />
          <button
            onClick={handleExport}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-secondary"
          >
            <Download className="h-3 w-3" />
            Export
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {/* Chapter header */}
            <div className="px-8 md:px-16 pt-12 pb-6">
              <div className="flex items-center gap-4 mb-2">
                <span className="flex items-center justify-center h-12 w-12 rounded-xl gradient-bg text-white text-lg font-bold">
                  {currentChapter.number}
                </span>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold">{currentChapter.title}</h1>
                  {currentChapter.subtitle && (
                    <p className="text-sm text-muted-foreground mt-1">{currentChapter.subtitle}</p>
                  )}
                </div>
              </div>
              <div className="mt-6 h-px bg-gradient-to-r from-primary/30 via-primary/10 to-transparent" />
            </div>

            {/* Chapter blocks (skip the chapter block itself) */}
            {currentChapter.blockIndices
              .filter((bi) => design.blocks[bi].type !== "chapter")
              .map((bi) => (
                <EditableBlock
                  key={bi}
                  block={design.blocks[bi]}
                  index={bi}
                  isActive={activeBlockIdx === bi}
                  isHighlighted={rippleHighlights.has(bi)}
                  onEdit={() => activeBlockIdx === bi ? closeChat() : openChat(bi)}
                />
              ))}

            {/* Chapter navigation footer */}
            <div className="px-8 md:px-16 py-12">
              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent mb-8" />
              <div className="flex items-center gap-4">
                {prevChapter ? (
                  <button
                    onClick={() => { setActiveChapterIdx(activeChapterIdx - 1); closeChat(); window.scrollTo(0, 0); }}
                    className="flex-1 flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors group text-left"
                  >
                    <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:-translate-x-0.5 transition-all shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground">Previous</p>
                      <p className="text-xs font-semibold truncate">{prevChapter.title}</p>
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={() => { setActiveChapterIdx(null); closeChat(); }}
                    className="flex-1 flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors group text-left"
                  >
                    <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:-translate-x-0.5 transition-all shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground">Back to</p>
                      <p className="text-xs font-semibold">Overview</p>
                    </div>
                  </button>
                )}
                {nextChapter ? (
                  <button
                    onClick={() => { setActiveChapterIdx(activeChapterIdx + 1); closeChat(); window.scrollTo(0, 0); }}
                    className="flex-1 flex items-center justify-end gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors group text-right"
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground">Next</p>
                      <p className="text-xs font-semibold truncate">{nextChapter.title}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ) : (
                  <button
                    onClick={() => { setActiveChapterIdx(null); closeChat(); }}
                    className="flex-1 flex items-center justify-end gap-3 rounded-xl gradient-bg p-4 text-white hover:opacity-90 transition-opacity group text-right"
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] opacity-70">Finished</p>
                      <p className="text-xs font-semibold">Back to Overview</p>
                    </div>
                    <Check className="h-4 w-4 opacity-70 shrink-0" />
                  </button>
                )}
              </div>
            </div>

            <div className="h-16" />
          </div>
        </div>

        {/* Chat sidebar */}
        {activeBlockIdx !== null && (
          <div className="w-[400px] shrink-0 border-l border-border bg-card flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-6 w-6 items-center justify-center rounded-full gradient-bg shrink-0">
                  <Bird className="h-3 w-3 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{blockLabel(design.blocks[activeBlockIdx])}</p>
                  <p className="text-[10px] text-muted-foreground">Tell me what to change</p>
                </div>
              </div>
              <button onClick={closeChat} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {chatMessages.length === 0 && !pendingRipple && (
                <p className="text-xs text-muted-foreground text-center mt-8">
                  Describe what you want to change.
                  <br />
                  <span className="text-[10px] mt-1 block">
                    I&apos;ll update this section and check if other parts need adjusting.
                  </span>
                </p>
              )}
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "text-xs rounded-lg px-3 py-2 max-w-[90%]",
                    msg.role === "user" ? "ml-auto bg-primary/10 text-foreground" : "mr-auto bg-secondary text-foreground"
                  )}
                >
                  {msg.content}
                </div>
              ))}
              {refining && (
                <div className="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-2">
                  <Loader2 className="h-3 w-3 animate-spin" />Updating &amp; analyzing impact...
                </div>
              )}
              {pendingRipple && pendingRipple.sectionChanges.length > 0 && (
                <div className="rounded-lg border border-amber-300/50 dark:border-amber-700/40 bg-amber-50/30 dark:bg-amber-950/10 p-3 space-y-3">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Proposed changes to other sections</p>
                  {pendingRipple.sectionChanges.map((change, i) => (
                    <div key={i} className="rounded-md border border-border bg-card p-2.5">
                      <p className="text-[11px] font-medium mb-0.5">{blockLabel(change.updatedBlock)}</p>
                      <p className="text-[10px] text-muted-foreground">{change.reason}</p>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <button onClick={applyRippleChanges} disabled={applyingRipple} className="flex-1 flex items-center justify-center gap-1.5 rounded-md gradient-bg px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
                      {applyingRipple ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Apply changes
                    </button>
                    <button onClick={dismissRipple} disabled={applyingRipple} className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-secondary disabled:opacity-50">
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="border-t border-border px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="What should change?"
                  rows={2}
                  disabled={refining || !!pendingRipple}
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none disabled:opacity-50"
                />
                <button onClick={sendMessage} disabled={!chatInput.trim() || refining || !!pendingRipple} className="flex items-center justify-center h-8 w-8 rounded-md gradient-bg text-white disabled:opacity-50 shrink-0">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Block renderers ─────────────────────────────────────────────────── */

function EditableBlock({ block, index, isActive, isHighlighted, onEdit }: {
  block: Block; index: number; isActive: boolean; isHighlighted: boolean; onEdit: () => void;
}) {
  if (block.type === "divider") return <RenderBlock block={block} />;

  return (
    <div className={cn(
      "group relative transition-all duration-300",
      isActive && "ring-2 ring-primary/20 rounded-lg",
      isHighlighted && "ring-2 ring-green-400/40 rounded-lg"
    )}>
      <button
        onClick={onEdit}
        className={cn(
          "absolute top-4 right-4 z-10 flex items-center justify-center h-8 w-8 rounded-full transition-all",
          isActive
            ? "gradient-bg text-white shadow-lg"
            : "bg-white/80 dark:bg-card/80 text-primary/60 opacity-0 group-hover:opacity-100 hover:bg-primary/10 hover:text-primary shadow-sm border border-transparent hover:border-primary/30"
        )}
        title="Edit with Birdie"
      >
        <Bird className="h-4 w-4" />
      </button>
      {isHighlighted && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 font-medium bg-green-50/80 dark:bg-green-950/60 rounded-full px-2 py-0.5">
          <Check className="h-3 w-3" /> Updated
        </div>
      )}
      <RenderBlock block={block} />
    </div>
  );
}

function RenderBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "hero": return null; // Hero is rendered in the TOC header

    case "chapter": return null; // Chapter headers rendered by parent

    case "prose":
      return (
        <div className="px-8 md:px-16 py-6">
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
            <Markdown content={block.content} />
          </div>
        </div>
      );

    case "stats":
      return (
        <div className="px-8 md:px-16 py-8">
          <div className={cn("grid gap-4", block.items.length <= 2 ? "grid-cols-2" : block.items.length === 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4")}>
            {block.items.map((item, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 text-center">
                <p className="text-2xl md:text-3xl font-bold gradient-text">{item.value}</p>
                <p className="text-xs font-semibold mt-1">{item.label}</p>
                {item.description && <p className="text-[10px] text-muted-foreground mt-1">{item.description}</p>}
              </div>
            ))}
          </div>
        </div>
      );

    case "cards":
      return (
        <div className="px-8 md:px-16 py-6">
          <div className={cn("grid gap-4", (block.columns ?? 2) === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
            {block.items.map((item, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors">
                <h4 className="text-sm font-semibold mb-2">{item.title}</h4>
                <div className="text-xs text-muted-foreground leading-relaxed"><Markdown content={item.content} /></div>
              </div>
            ))}
          </div>
        </div>
      );

    case "quote":
      return (
        <div className="px-8 md:px-16 py-10">
          <div className="relative border-l-4 border-primary/40 pl-6 py-2">
            <p className="text-base md:text-lg font-medium italic leading-relaxed">&ldquo;{block.text}&rdquo;</p>
            {block.attribution && <p className="text-xs text-muted-foreground mt-3">&mdash; {block.attribution}</p>}
          </div>
        </div>
      );

    case "two-column":
      return (
        <div className="px-8 md:px-16 py-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-border bg-card p-5">
              <h4 className="text-sm font-semibold mb-3">{block.left.title}</h4>
              <div className="text-xs text-muted-foreground leading-relaxed"><Markdown content={block.left.content} /></div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h4 className="text-sm font-semibold mb-3">{block.right.title}</h4>
              <div className="text-xs text-muted-foreground leading-relaxed"><Markdown content={block.right.content} /></div>
            </div>
          </div>
        </div>
      );

    case "callout": {
      const variants = {
        insight: { border: "border-primary/30", bg: "bg-primary/5", icon: <Lightbulb className="h-4 w-4 text-primary" /> },
        warning: { border: "border-amber-400/40", bg: "bg-amber-50/30 dark:bg-amber-950/10", icon: <AlertTriangle className="h-4 w-4 text-amber-500" /> },
        opportunity: { border: "border-green-400/40", bg: "bg-green-50/30 dark:bg-green-950/10", icon: <CheckCircle2 className="h-4 w-4 text-green-600" /> },
      };
      const v = variants[block.variant] ?? variants.insight;
      return (
        <div className="px-8 md:px-16 py-6">
          <div className={cn("rounded-xl border p-5", v.border, v.bg)}>
            <div className="flex items-center gap-2 mb-2">{v.icon}<h4 className="text-sm font-semibold">{block.title}</h4></div>
            <div className="text-xs leading-relaxed"><Markdown content={block.content} /></div>
          </div>
        </div>
      );
    }

    case "table":
      return (
        <div className="px-8 md:px-16 py-6">
          {block.caption && <p className="text-xs font-semibold text-muted-foreground mb-2">{block.caption}</p>}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead><tr className="bg-secondary/50">{block.headers.map((h, i) => <th key={i} className="px-4 py-2.5 text-left font-semibold">{h}</th>)}</tr></thead>
              <tbody>{block.rows.map((row, ri) => <tr key={ri} className="border-t border-border">{row.map((cell, ci) => <td key={ci} className="px-4 py-2.5 text-muted-foreground">{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </div>
      );

    case "list":
      return (
        <div className="px-8 md:px-16 py-6">
          <h4 className="text-sm font-semibold mb-3">{block.title}</h4>
          <div className="space-y-2.5">
            {block.items.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0">
                  {block.variant === "numbered" ? (
                    <span className="flex items-center justify-center h-5 w-5 rounded-full gradient-bg text-white text-[10px] font-bold">{i + 1}</span>
                  ) : block.variant === "check" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <ArrowRight className="h-4 w-4 text-primary" />
                  )}
                </span>
                <div>
                  <p className="text-xs font-medium">{item.title}</p>
                  {item.description && <p className="text-[11px] text-muted-foreground mt-0.5">{item.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "divider":
      return (
        <div className="px-8 md:px-16 py-8">
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
      );

    case "accordion":
      return <AccordionRenderer block={block} />;

    case "scored-list":
      return (
        <div className="px-8 md:px-16 py-6">
          {block.title && <h4 className="text-sm font-semibold mb-4">{block.title}</h4>}
          <div className="space-y-2">
            {block.items.map((item, i) => {
              const v = item.variant ?? (typeof item.score === "number" ? (item.score >= 85 ? "red" : item.score >= 70 ? "orange" : "green") : "green");
              const colors = { red: "text-red-500 border-red-500/20 bg-red-500/5", orange: "text-amber-500 border-amber-500/20 bg-amber-500/5", green: "text-green-500 border-border bg-card" };
              return (
                <div key={i} className={cn("flex items-center gap-4 rounded-lg border p-3.5", colors[v])}>
                  <span className="text-lg font-bold font-mono w-10 text-center shrink-0">{item.score}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{item.label}</p>
                    {item.sublabel && <p className="text-[10px] text-muted-foreground mt-0.5">{item.sublabel}</p>}
                  </div>
                  {item.badge && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground shrink-0">{item.badge}</span>}
                </div>
              );
            })}
          </div>
        </div>
      );

    case "segment-cards":
      return (
        <div className="px-8 md:px-16 py-6">
          <div className="space-y-3">
            {block.items.map((seg, i) => {
              const tierColors: Record<string, string> = { "1A": "gradient-bg text-white", "1B": "bg-amber-500 text-white", "2": "bg-green-600 text-white", "3": "bg-secondary text-muted-foreground" };
              return (
                <div key={i} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", tierColors[seg.tier] ?? "bg-secondary text-muted-foreground")}>Tier {seg.tier}</span>
                    <h4 className="text-sm font-semibold">{seg.name}</h4>
                  </div>
                  {seg.message && <p className="text-xs italic text-muted-foreground mb-3">&ldquo;{seg.message}&rdquo;</p>}
                  <div className="flex flex-wrap gap-x-5 gap-y-1">
                    {Object.entries(seg.metrics).map(([k, v]) => (
                      <span key={k} className="text-[11px] text-muted-foreground">{k}: <strong className="text-foreground">{v}</strong></span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );

    case "timeline":
      return (
        <div className="px-8 md:px-16 py-6">
          {block.title && <h4 className="text-sm font-semibold mb-4">{block.title}</h4>}
          <div className="space-y-6">
            {block.periods.map((period, pi) => {
              const statusStyles = { past: "bg-secondary text-muted-foreground", current: "bg-amber-500/15 text-amber-600 border border-amber-500/30", future: "bg-secondary/60 text-foreground" };
              return (
                <div key={pi}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={cn("text-xs font-bold px-3 py-1 rounded-full", statusStyles[period.status])}>{period.label}</span>
                    {period.status === "current" && <span className="text-[10px] font-semibold text-amber-600">CURRENT</span>}
                  </div>
                  <div className="border-l-2 border-border pl-4 space-y-1.5 ml-2">
                    {period.items.map((item, ii) => {
                      const dotColors = { red: "bg-red-500", orange: "bg-amber-500", green: "bg-green-500" };
                      return (
                        <div key={ii} className="flex items-center gap-3 rounded-lg bg-card/50 px-3 py-2">
                          <span className={cn("h-2 w-2 rounded-full shrink-0", dotColors[item.variant ?? "green"] ?? "bg-muted-foreground")} />
                          <span className="text-xs text-foreground flex-1">{item.text}</span>
                          {item.badge && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-border text-muted-foreground shrink-0">{item.badge}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );

    case "tabs":
      return <TabsRenderer block={block} />;

    case "direction-cards":
      return (
        <div className="px-8 md:px-16 py-6">
          <div className="space-y-3">
            {block.items.map((dir, i) => {
              const priColors: Record<string, string> = { Primary: "gradient-bg text-white", Secondary: "bg-green-600 text-white", "Cross-cutting": "bg-purple-600 text-white" };
              return (
                <div key={i} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold">{dir.segment}</h4>
                    <div className="flex items-center gap-2">
                      {dir.priority && <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", priColors[dir.priority] ?? "bg-secondary text-muted-foreground")}>{dir.priority}</span>}
                      {dir.target && <span className="text-xs font-bold font-mono text-primary">{dir.target}</span>}
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <p><strong className="text-green-600">GET</strong> <span className="text-muted-foreground">{dir.get}</span></p>
                    <p><strong className="text-primary">TO</strong> <span className="text-muted-foreground">{dir.to}</span></p>
                    <p><strong className="text-amber-600">BY</strong> <span className="text-muted-foreground">{dir.by}</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );

    case "comparison":
      return <ComparisonRenderer block={block} />;

    case "phases":
      return (
        <div className="px-8 md:px-16 py-6">
          <div className={cn("grid gap-3", block.items.length <= 4 ? `grid-cols-${block.items.length}` : "grid-cols-2 md:grid-cols-4")}>
            {block.items.map((phase, i) => {
              const phaseColors = ["border-blue-500/30 bg-blue-500/5", "border-green-500/30 bg-green-500/5", "border-amber-500/30 bg-amber-500/5", "border-purple-500/30 bg-purple-500/5", "border-red-500/30 bg-red-500/5", "border-cyan-500/30 bg-cyan-500/5"];
              return (
                <div key={i} className={cn("rounded-xl border p-4", phaseColors[i % phaseColors.length])}>
                  <p className="text-xs font-bold">{phase.label}</p>
                  {phase.sublabel && <p className="text-[10px] text-muted-foreground mt-0.5">{phase.sublabel}</p>}
                  {phase.description && <p className="text-[10px] text-muted-foreground mt-2">{phase.description}</p>}
                </div>
              );
            })}
          </div>
        </div>
      );

    default: return null;
  }
}

/* ── Stateful block components ───────────────────────────────────────── */

function AccordionRenderer({ block }: { block: AccordionBlock }) {
  const [openItems, setOpenItems] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    block.items.forEach((item, i) => { if (item.open) initial.add(i); });
    return initial;
  });

  return (
    <div className="px-8 md:px-16 py-6">
      {block.title && <h4 className="text-sm font-semibold mb-3">{block.title}</h4>}
      <div className="space-y-1.5">
        {block.items.map((item, i) => (
          <div key={i} className={cn("rounded-lg border transition-colors", openItems.has(i) ? "border-primary/20 bg-primary/[0.02]" : "border-border")}>
            <button
              onClick={() => setOpenItems((prev) => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; })}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
              <ChevronRight className={cn("h-3.5 w-3.5 text-primary transition-transform shrink-0", openItems.has(i) && "rotate-90")} />
              <span className="text-xs font-semibold flex-1">{item.title}</span>
              {item.badge && (
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full",
                  item.badge === "HIGH" || item.badge === "Critical" ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                  item.badge === "MEDIUM" || item.badge === "High" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                  "bg-green-500/10 text-green-500 border border-green-500/20"
                )}>{item.badge}</span>
              )}
            </button>
            {openItems.has(i) && (
              <div className="px-4 pb-3 pl-10 text-xs text-muted-foreground leading-relaxed">
                <Markdown content={item.content} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TabsRenderer({ block }: { block: TabsBlock }) {
  const [activeTab, setActiveTab] = useState(0);
  return (
    <div className="px-8 md:px-16 py-6">
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {block.tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={cn(
              "px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors",
              i === activeTab ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {block.tabs[activeTab]?.items.map((item, i) => (
          <AccordionItem key={i} title={item.title} content={item.content} />
        ))}
      </div>
    </div>
  );
}

function AccordionItem({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("rounded-lg border transition-colors", open ? "border-primary/20 bg-primary/[0.02]" : "border-border")}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <ChevronRight className={cn("h-3.5 w-3.5 text-primary transition-transform shrink-0", open && "rotate-90")} />
        <span className="text-xs font-semibold flex-1">{title}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 pl-10 text-xs text-muted-foreground leading-relaxed">
          <Markdown content={content} />
        </div>
      )}
    </div>
  );
}

function ComparisonRenderer({ block }: { block: ComparisonBlock }) {
  const [openIdx, setOpenIdx] = useState(0);
  const fieldColors: Record<string, string> = { Strengths: "text-green-500", Weaknesses: "text-red-400", "Topsoe Advantage": "text-blue-400", "Topsoe Vulnerability": "text-amber-500", Advantages: "text-green-500", Disadvantages: "text-red-400" };

  return (
    <div className="px-8 md:px-16 py-6">
      <div className="space-y-1.5">
        {block.items.map((comp, i) => (
          <div key={i} className={cn("rounded-lg border transition-colors", openIdx === i ? "border-primary/20 bg-primary/[0.02]" : "border-border")}>
            <button onClick={() => setOpenIdx(openIdx === i ? -1 : i)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
              <ChevronRight className={cn("h-3.5 w-3.5 text-primary transition-transform shrink-0", openIdx === i && "rotate-90")} />
              <span className="text-xs font-semibold flex-1">{comp.name}</span>
              {comp.badge && (
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full",
                  comp.badge === "HIGH" ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                  comp.badge === "MEDIUM" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                  "bg-green-500/10 text-green-500 border border-green-500/20"
                )}>{comp.badge}</span>
              )}
            </button>
            {openIdx === i && (
              <div className="px-4 pb-4 pl-10 grid md:grid-cols-2 gap-4">
                {Object.entries(comp.fields).map(([label, content]) => (
                  <div key={label}>
                    <p className={cn("text-[10px] font-bold uppercase tracking-wide mb-1.5", fieldColors[label] ?? "text-muted-foreground")}>{label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function blockLabel(block: Block): string {
  switch (block.type) {
    case "hero": return block.title;
    case "chapter": return `Ch ${block.number}: ${block.title}`;
    case "quote": return "Quote";
    case "callout": return block.title;
    case "stats": return "Key metrics";
    case "table": return block.caption || "Table";
    case "list": return block.title;
    case "prose": return "Content";
    case "cards": return `${block.items.length} cards`;
    case "two-column": return `${block.left.title} / ${block.right.title}`;
    case "divider": return "Divider";
    case "accordion": return block.title || "Details";
    case "scored-list": return block.title || "Rankings";
    case "segment-cards": return `${block.items.length} segments`;
    case "timeline": return block.title || "Timeline";
    case "tabs": return `${block.tabs.length} tabs`;
    case "direction-cards": return `${block.items.length} directions`;
    case "comparison": return `${block.items.length} compared`;
    case "phases": return `${block.items.length} phases`;
    default: return "Block";
  }
}

function blockToMarkdown(block: Block): string {
  switch (block.type) {
    case "hero": return `# ${block.title}\n\n*${block.subtitle}*\n\n${block.abstract}`;
    case "chapter": return `## Chapter ${block.number}: ${block.title}${block.subtitle ? `\n\n*${block.subtitle}*` : ""}`;
    case "prose": return block.content;
    case "quote": return `> "${block.text}"${block.attribution ? `\n> — ${block.attribution}` : ""}`;
    case "stats": return block.items.map((s) => `- **${s.value}** — ${s.label}`).join("\n");
    case "cards": return block.items.map((c) => `### ${c.title}\n${c.content}`).join("\n\n");
    case "two-column": return `### ${block.left.title}\n${block.left.content}\n\n### ${block.right.title}\n${block.right.content}`;
    case "callout": return `> **${block.title}**\n> ${block.content}`;
    case "table": return block.headers.length ? [`| ${block.headers.join(" | ")} |`, `| ${block.headers.map(() => "---").join(" | ")} |`, ...block.rows.map((r) => `| ${r.join(" | ")} |`)].join("\n") : "";
    case "list": return block.items.map((it, i) => `${i + 1}. **${it.title}**${it.description ? ` — ${it.description}` : ""}`).join("\n");
    case "divider": return "---";
    case "accordion": return `### ${block.title}\n${block.items.map((it) => `#### ${it.title}\n${it.content}`).join("\n\n")}`;
    case "scored-list": return `### ${block.title}\n${block.items.map((it) => `- [${it.score}] **${it.label}**${it.sublabel ? ` — ${it.sublabel}` : ""}`).join("\n")}`;
    case "segment-cards": return block.items.map((s) => `### [Tier ${s.tier}] ${s.name}\n*${s.message}*\n${Object.entries(s.metrics).map(([k, v]) => `- ${k}: ${v}`).join("\n")}`).join("\n\n");
    case "timeline": return `### ${block.title}\n${block.periods.map((p) => `#### ${p.label}\n${p.items.map((it) => `- ${it.text}${it.badge ? ` [${it.badge}]` : ""}`).join("\n")}`).join("\n\n")}`;
    case "tabs": return block.tabs.map((t) => `### ${t.label}\n${t.items.map((it) => `#### ${it.title}\n${it.content}`).join("\n\n")}`).join("\n\n");
    case "direction-cards": return block.items.map((d) => `### ${d.segment}\n**GET** ${d.get}\n**TO** ${d.to}\n**BY** ${d.by}`).join("\n\n");
    case "comparison": return block.items.map((c) => `### ${c.name}\n${Object.entries(c.fields).map(([k, v]) => `**${k}:** ${v}`).join("\n")}`).join("\n\n");
    case "phases": return block.items.map((p) => `- **${p.label}**${p.sublabel ? ` (${p.sublabel})` : ""}${p.description ? ` — ${p.description}` : ""}`).join("\n");
    default: return "";
  }
}

/* ── Markdown renderer ───────────────────────────────────────────────── */

function Markdown({ content }: { content: string }) {
  const prefix = useId();
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: "ul" | "ol" | null = null;

  function flushList() {
    if (listItems.length > 0 && listType) {
      const Tag = listType;
      elements.push(
        <Tag key={`${prefix}-l${elements.length}`} className={listType === "ol" ? "list-decimal pl-5 space-y-1" : "list-disc pl-5 space-y-1"}>
          {listItems.map((item, i) => <li key={i}><Inline text={item} /></li>)}
        </Tag>
      );
      listItems = [];
      listType = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const k = `${prefix}-${i}`;
    const line = lines[i];
    const h3 = line.match(/^###\s+(.*)/);
    if (h3) { flushList(); elements.push(<h3 key={k} className="text-sm font-semibold mt-4 mb-1"><Inline text={h3[1]} /></h3>); continue; }
    const h2 = line.match(/^##\s+(.*)/);
    if (h2) { flushList(); elements.push(<h2 key={k} className="text-base font-semibold mt-5 mb-2"><Inline text={h2[1]} /></h2>); continue; }
    const h1 = line.match(/^#\s+(.*)/);
    if (h1) { flushList(); elements.push(<h1 key={k} className="text-lg font-bold mt-5 mb-2"><Inline text={h1[1]} /></h1>); continue; }
    const ul = line.match(/^[-*]\s+(.*)/);
    if (ul) { if (listType !== "ul") { flushList(); listType = "ul"; } listItems.push(ul[1]); continue; }
    const ol = line.match(/^\d+\.\s+(.*)/);
    if (ol) { if (listType !== "ol") { flushList(); listType = "ol"; } listItems.push(ol[1]); continue; }
    flushList();
    if (line.trim() === "") continue;
    elements.push(<p key={k} className="mb-2"><Inline text={line} /></p>);
  }
  flushList();
  return <>{elements}</>;
}

function Inline({ text }: { text: string }) {
  const id = useId();
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  let lastIdx = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index));
    if (match[2]) parts.push(<strong key={`${id}-${match.index}`}>{match[2]}</strong>);
    else if (match[4]) parts.push(<em key={`${id}-${match.index}`}>{match[4]}</em>);
    else if (match[6]) parts.push(<code key={`${id}-${match.index}`} className="rounded bg-secondary px-1 py-0.5 text-[11px]">{match[6]}</code>);
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return <>{parts.length > 0 ? parts : text}</>;
}
