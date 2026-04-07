"use client";

import { use } from "react";
import { redirect } from "next/navigation";

export default function CampaignSetupRedirect({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = use(params);
  redirect(`/campaign/${campaignId}`);
}
