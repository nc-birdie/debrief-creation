"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Timer,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RenderedMarkdown } from "./rendered-markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Suggestion {
  label: string;
  description: string;
  focusPrompt: string;
}

type InterviewStatus =
  | "idle"
  | "preparing"
  | "picking"
  | "starting"
  | "active"
  | "completing"
  | "completed"
  | "error";

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function InterviewerChat({
  campaignId,
  onKnowledgeRegistered,
}: {
  campaignId: string;
  onKnowledgeRegistered: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<InterviewStatus>("idle");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [thinking, setThinking] = useState(false);
  const [completionResult, setCompletionResult] = useState<{
    entriesCreated: number;
    sourceName: string;
  } | null>(null);
  const [inactivityCountdown, setInactivityCountdown] = useState<number | null>(
    null
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );
  const inactivityStartRef = useRef<number | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current && status === "active") {
      inputRef.current.focus();
    }
  }, [open, status]);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    inactivityStartRef.current = null;
    setInactivityCountdown(null);
  }, []);

  const completeInterview = useCallback(
    async (msgs: ChatMessage[]) => {
      if (
        msgs.length < 2 ||
        status === "completing" ||
        status === "completed"
      ) {
        return;
      }
      clearInactivityTimer();
      setStatus("completing");

      try {
        const res = await fetch(
          `/api/campaigns/${campaignId}/interview/complete`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: msgs }),
          }
        );
        const data = await res.json();

        if (res.ok && data.entriesCreated > 0) {
          setCompletionResult({
            entriesCreated: data.entriesCreated,
            sourceName: data.sourceName,
          });
          setStatus("completed");
          onKnowledgeRegistered();
        } else if (res.ok) {
          setCompletionResult({
            entriesCreated: 0,
            sourceName: "",
          });
          setStatus("completed");
        } else {
          console.error("[interview] Complete failed:", data.error);
          setStatus("error");
        }
      } catch (err) {
        console.error("[interview] Complete error:", err);
        setStatus("error");
      }
    },
    [campaignId, status, clearInactivityTimer, onKnowledgeRegistered]
  );

  const resetInactivityTimer = useCallback(
    (msgs: ChatMessage[]) => {
      clearInactivityTimer();

      if (msgs.length < 2) return;

      inactivityStartRef.current = Date.now();

      countdownIntervalRef.current = setInterval(() => {
        if (!inactivityStartRef.current) return;
        const elapsed = Date.now() - inactivityStartRef.current;
        const remaining = Math.ceil(
          (INACTIVITY_TIMEOUT_MS - elapsed) / 1000
        );
        if (remaining <= 60) {
          setInactivityCountdown(remaining);
        }
      }, 1000);

      inactivityTimerRef.current = setTimeout(() => {
        completeInterview(msgs);
      }, INACTIVITY_TIMEOUT_MS);
    },
    [clearInactivityTimer, completeInterview]
  );

  useEffect(() => {
    return () => {
      clearInactivityTimer();
    };
  }, [clearInactivityTimer]);

  async function fetchSuggestions() {
    setStatus("preparing");

    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/interview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "suggest" }),
        }
      );
      const data = await res.json();

      if (res.ok && data.suggestions?.length > 0) {
        setSuggestions(data.suggestions);
        setStatus("picking");
      } else {
        setStatus("error");
      }
    } catch (err) {
      console.error("[interview] Suggest error:", err);
      setStatus("error");
    }
  }

  async function startWithFocus(focusArea: string) {
    setStatus("starting");
    setThinking(true);

    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/interview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [],
            action: "start",
            focusArea,
          }),
        }
      );
      const data = await res.json();

      if (res.ok && data.message) {
        const newMessages: ChatMessage[] = [
          { role: "assistant", content: data.message },
        ];
        setMessages(newMessages);
        setStatus("active");
        resetInactivityTimer(newMessages);
      } else {
        setStatus("error");
      }
    } catch (err) {
      console.error("[interview] Start error:", err);
      setStatus("error");
    } finally {
      setThinking(false);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || thinking || status !== "active") return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setThinking(true);
    clearInactivityTimer();

    try {
      const res = await fetch(
        `/api/campaigns/${campaignId}/interview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: updatedMessages }),
        }
      );
      const data = await res.json();

      if (res.ok && data.message) {
        const withResponse = [
          ...updatedMessages,
          { role: "assistant" as const, content: data.message },
        ];
        setMessages(withResponse);
        resetInactivityTimer(withResponse);
      }
    } catch (err) {
      console.error("[interview] Send error:", err);
    } finally {
      setThinking(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleOpen() {
    setOpen(true);
    if (status === "idle") {
      fetchSuggestions();
    }
  }

  function handleNewInterview() {
    setMessages([]);
    setSuggestions([]);
    setCompletionResult(null);
    setStatus("idle");
    clearInactivityTimer();
    fetchSuggestions();
  }

  const statusLabel =
    status === "active"
      ? "Gathering context to fill knowledge gaps"
      : status === "completing"
        ? "Registering knowledge..."
        : status === "completed"
          ? "Interview complete"
          : status === "starting"
            ? "Launching interview..."
            : status === "preparing"
              ? "Preparing interview..."
              : status === "picking"
                ? "Pick a direction to start"
                : "Ready to start";

  return (
    <>
      {/* Floating toggle button */}
      {!open && (
        <button
          onClick={handleOpen}
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg transition-all hover:scale-105",
            "gradient-bg text-white"
          )}
        >
          <MessageCircle className="h-5 w-5" />
          <span className="text-sm font-medium">Interview</span>
          {messages.length > 0 && status === "active" && (
            <span className="flex h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          )}
        </button>
      )}

      {/* Sidebar panel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-[420px] max-w-[100vw] border-l border-border bg-background shadow-2xl transition-transform duration-300 ease-in-out flex flex-col",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-bg">
              <MessageCircle className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Context Interview</h3>
              <p className="text-[10px] text-muted-foreground">{statusLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {inactivityCountdown !== null && inactivityCountdown > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-amber-500 mr-2">
                <Timer className="h-3 w-3" />
                <span>Auto-save in {inactivityCountdown}s</span>
              </div>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-md hover:bg-secondary transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        >
          {/* Preparing state */}
          {status === "preparing" && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Preparing interview...</p>
              <p className="text-xs text-center max-w-[280px]">
                Analyzing your knowledge base to find the most valuable areas to
                explore
              </p>
            </div>
          )}

          {/* Topic picker */}
          {status === "picking" && suggestions.length > 0 && (
            <div className="space-y-4">
              <div className="text-center space-y-1.5 pt-2 pb-1">
                <p className="text-sm font-medium">
                  Where should we focus?
                </p>
                <p className="text-xs text-muted-foreground max-w-[300px] mx-auto">
                  Pick a direction to start the interview. You can always explore
                  other areas as the conversation develops.
                </p>
              </div>

              <div className="space-y-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => startWithFocus(s.focusPrompt)}
                    className="w-full group rounded-lg border border-border bg-card p-3.5 text-left hover:border-primary/40 hover:bg-secondary/30 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium group-hover:text-primary transition-colors">
                          {s.label}
                        </span>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {s.description}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Starting — waiting for first question */}
          {status === "starting" && thinking && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Preparing first question...</p>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-secondary text-secondary-foreground rounded-bl-md"
                )}
              >
                {msg.role === "assistant" ? (
                  <RenderedMarkdown content={msg.content} />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {/* Thinking indicator during active chat */}
          {thinking && status === "active" && (
            <div className="flex justify-start">
              <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {/* Completion banner */}
          {status === "completing" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Extracting knowledge from interview...</span>
              </div>
            </div>
          )}

          {status === "completed" && completionResult && (
            <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 px-4 py-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {completionResult.entriesCreated > 0
                    ? `${completionResult.entriesCreated} knowledge entries registered`
                    : "No new knowledge extracted"}
                </span>
              </div>
              {completionResult.entriesCreated > 0 && (
                <p className="text-xs text-green-600 dark:text-green-500">
                  Source: {completionResult.sourceName}
                </p>
              )}
              <button
                onClick={handleNewInterview}
                className="mt-2 text-xs font-medium text-green-700 dark:text-green-400 hover:underline"
              >
                Start another interview
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span>Something went wrong. Please try again.</span>
              </div>
              <button
                onClick={handleNewInterview}
                className="mt-2 text-xs font-medium text-red-700 dark:text-red-400 hover:underline"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Input area */}
        {status === "active" && (
          <div className="border-t border-border px-4 py-3 bg-card shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer..."
                rows={1}
                disabled={thinking}
                className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                style={{
                  minHeight: "38px",
                  maxHeight: "120px",
                  height: "auto",
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || thinking}
                className="flex h-[38px] w-[38px] items-center justify-center rounded-lg gradient-bg text-white disabled:opacity-50 shrink-0 transition-opacity"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-muted-foreground">
                Shift+Enter for new line
              </p>
              <button
                onClick={() => completeInterview(messages)}
                disabled={messages.length < 2 || thinking}
                className="text-[10px] font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline"
              >
                End interview & register knowledge
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Backdrop when open on mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
