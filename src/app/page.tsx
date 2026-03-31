"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Compass, Settings, Trash2, ArrowRight, User, Lock } from "lucide-react";
import type { Campaign, UserSummary } from "@/lib/types";
import { slugify } from "@/lib/utils";

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<"select" | "new" | "birdie">("select");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [currentUser, setCurrentUser] = useState<UserSummary | null>(null);

  const fetchCampaigns = useCallback(async () => {
    const res = await fetch("/api/campaigns");
    if (res.ok) setCampaigns(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCampaigns();
    fetch("/api/users/me")
      .then((r) => r.json())
      .then(setCurrentUser)
      .catch(() => {});
  }, [fetchCampaigns]);

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        slug: slugify(newName.trim()),
        description: newDesc.trim(),
      }),
    });
    if (res.ok) {
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      setCreateMode("select");
      fetchCampaigns();
    }
  }

  async function deleteCampaign(id: string) {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    fetchCampaigns();
  }

  const statusLabel: Record<string, string> = {
    setup: "Setup",
    in_progress: "In Progress",
    completed: "Completed",
  };

  const statusColor: Record<string, string> = {
    setup: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md gradient-bg">
              <Compass className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-lg font-bold">Direction Setting</h1>
          </div>
          <div className="flex items-center gap-3">
            {currentUser && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                {currentUser.displayName || currentUser.username}
              </span>
            )}
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              Admin
            </Link>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-md gradient-bg px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              <Plus className="h-3.5 w-3.5" />
              New Program
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Create dialog */}
        {showCreate && (
          <div className="mb-8 rounded-lg border border-border bg-card p-6">
            <h2 className="text-base font-semibold mb-4">New Program</h2>

            {createMode === "select" ? (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setCreateMode("birdie")}
                  className="relative rounded-lg border border-border p-5 text-left hover:border-primary/40 transition-colors opacity-60 cursor-not-allowed"
                  disabled
                >
                  <div className="absolute top-3 right-3">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-md gradient-bg mb-3">
                    <Compass className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold mb-1">Birdie Program</h3>
                  <p className="text-xs text-muted-foreground">
                    Import an existing program from Birdie Studio with pre-loaded context, sources, and client data.
                  </p>
                  <span className="inline-block mt-3 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 text-[10px] font-medium">
                    Coming Soon
                  </span>
                </button>

                <button
                  onClick={() => setCreateMode("new")}
                  className="rounded-lg border border-border p-5 text-left hover:border-primary/40 transition-colors"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary mb-3">
                    <Plus className="h-4 w-4 text-foreground" />
                  </div>
                  <h3 className="text-sm font-semibold mb-1">Create New</h3>
                  <p className="text-xs text-muted-foreground">
                    Start a fresh program from scratch. Add your own sources and build context manually.
                  </p>
                </button>

                <div className="col-span-2 flex justify-end">
                  <button
                    onClick={() => { setShowCreate(false); setCreateMode("select"); }}
                    className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : createMode === "new" ? (
              <form onSubmit={createCampaign} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Topsoe eREACT Launch"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Brief context about this program..."
                    rows={2}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-md gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateMode("select")}
                    className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
                  >
                    Back
                  </button>
                </div>
              </form>
            ) : (
              /* Birdie Program placeholder — disabled for now */
              <div className="text-center py-8 text-muted-foreground text-sm">
                Birdie Studio integration coming soon.
                <div className="mt-4">
                  <button
                    onClick={() => setCreateMode("select")}
                    className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Campaign grid */}
        {loading ? (
          <div className="text-center py-20 text-muted-foreground text-sm">
            Loading...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-20">
            <Compass className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
            <h2 className="text-lg font-semibold mb-1">No programs yet</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Create your first program to start setting direction.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 rounded-md gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              New Program
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="group relative rounded-lg border border-border bg-card p-5 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[c.status] ?? ""}`}
                  >
                    {statusLabel[c.status] ?? c.status}
                  </span>
                  <button
                    onClick={() => deleteCampaign(c.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <h3 className="font-semibold mb-1">{c.name}</h3>
                {c.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {c.description}
                  </p>
                )}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">
                      Step {c.currentStep} / 13
                    </span>
                    {c.createdBy && (
                      <span className="text-[10px] text-muted-foreground/70">
                        by {c.createdBy.displayName || c.createdBy.username}
                      </span>
                    )}
                  </div>
                  <Link
                    href={
                      c.status === "setup"
                        ? `/campaign/${c.id}/setup`
                        : `/campaign/${c.id}`
                    }
                    className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {c.status === "setup" ? "Setup" : "Continue"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
