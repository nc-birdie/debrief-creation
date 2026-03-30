"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Compass, Settings, Trash2, ArrowRight } from "lucide-react";
import type { Campaign } from "@/lib/types";
import { slugify } from "@/lib/utils";

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const fetchCampaigns = useCallback(async () => {
    const res = await fetch("/api/campaigns");
    if (res.ok) setCampaigns(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCampaigns();
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
          <div className="flex items-center gap-2">
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
              New Campaign
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Create dialog */}
        {showCreate && (
          <div className="mb-8 rounded-lg border border-border bg-card p-6">
            <h2 className="text-base font-semibold mb-4">New Campaign</h2>
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
                  placeholder="Brief context about this campaign..."
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
                  onClick={() => setShowCreate(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
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
            <h2 className="text-lg font-semibold mb-1">No campaigns yet</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Create your first campaign to start setting direction.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 rounded-md gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              New Campaign
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
                  <span className="text-xs text-muted-foreground">
                    Step {c.currentStep} / 13
                  </span>
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
