import type { Campaign, Source, StepState, StepMutation, KnowledgeEntry } from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

// Campaigns
export async function fetchCampaigns(): Promise<Campaign[]> {
  return json(await fetch("/api/campaigns"));
}

export async function fetchCampaign(id: string): Promise<Campaign> {
  return json(await fetch(`/api/campaigns/${id}`));
}

export async function createCampaign(data: {
  name: string;
  slug: string;
  description?: string;
}): Promise<Campaign> {
  return json(
    await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  );
}

export async function updateCampaign(
  id: string,
  data: Partial<Pick<Campaign, "name" | "description" | "status" | "currentStep">>
): Promise<Campaign> {
  return json(
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  );
}

export async function deleteCampaign(id: string): Promise<void> {
  const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

// Sources
export async function fetchSources(campaignId: string): Promise<Source[]> {
  return json(await fetch(`/api/campaigns/${campaignId}/sources`));
}

export async function addSource(
  campaignId: string,
  data: { name: string; filePath: string; fileType?: string }
): Promise<Source> {
  return json(
    await fetch(`/api/campaigns/${campaignId}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  );
}

export async function deleteSource(
  campaignId: string,
  sourceId: string
): Promise<void> {
  const res = await fetch(`/api/campaigns/${campaignId}/sources/${sourceId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

export async function ingestSources(campaignId: string): Promise<void> {
  const res = await fetch(`/api/campaigns/${campaignId}/ingest`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Ingest failed: ${res.status}`);
}

// Steps
export async function fetchStep(
  campaignId: string,
  stepNumber: number
): Promise<StepState> {
  return json(
    await fetch(`/api/campaigns/${campaignId}/steps/${stepNumber}`)
  );
}

export async function mutateStep(
  campaignId: string,
  stepNumber: number,
  mutation: StepMutation
): Promise<StepState> {
  return json(
    await fetch(`/api/campaigns/${campaignId}/steps/${stepNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mutation),
    })
  );
}

export async function generateStep(
  campaignId: string,
  stepNumber: number
): Promise<StepState> {
  return json(
    await fetch(`/api/campaigns/${campaignId}/steps/${stepNumber}/generate`, {
      method: "POST",
    })
  );
}

// Knowledge entries
export async function fetchKnowledge(
  campaignId: string
): Promise<KnowledgeEntry[]> {
  return json(await fetch(`/api/campaigns/${campaignId}/knowledge`));
}

export async function createKnowledgeEntry(
  campaignId: string,
  data: { area: string; title: string; content: string }
): Promise<KnowledgeEntry> {
  return json(
    await fetch(`/api/campaigns/${campaignId}/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  );
}

export async function updateKnowledgeEntry(
  campaignId: string,
  entryId: string,
  data: Partial<Pick<KnowledgeEntry, "title" | "content" | "area">>
): Promise<KnowledgeEntry> {
  return json(
    await fetch(`/api/campaigns/${campaignId}/knowledge/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  );
}

export async function deleteKnowledgeEntry(
  campaignId: string,
  entryId: string
): Promise<void> {
  const res = await fetch(
    `/api/campaigns/${campaignId}/knowledge/${entryId}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}
