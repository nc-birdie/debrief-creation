export interface ArtefactTypeDef {
  id: string;
  label: string;
  description: string;
  category: "research" | "direction_setting";
}

export const ARTEFACT_TYPES: ArtefactTypeDef[] = [
  // ── Research Artefacts ──
  {
    id: "market_research",
    label: "Market Research Report",
    description: "In-depth analysis of market dynamics, trends, sizing, and opportunities",
    category: "research",
  },
  {
    id: "competitive_analysis",
    label: "Competitive Analysis",
    description: "Detailed comparison of competitors, positioning, strengths, and weaknesses",
    category: "research",
  },
  {
    id: "customer_research",
    label: "Customer Research Report",
    description: "Insights from customer interviews, surveys, pain points, and needs analysis",
    category: "research",
  },
  {
    id: "industry_report",
    label: "Industry Trends Report",
    description: "Macro trends, regulatory shifts, technology adoption curves, and forecasts",
    category: "research",
  },
  {
    id: "audience_analysis",
    label: "Audience Analysis",
    description: "Target audience segmentation, personas, and behavioral insights",
    category: "research",
  },
  {
    id: "custom_research",
    label: "Custom Research",
    description: "Custom research artefact",
    category: "research",
  },

  // ── Direction Setting Artefacts ──
  {
    id: "message_house",
    label: "Message House",
    description: "Structured messaging framework with key messages, proof points, and pillars",
    category: "direction_setting",
  },
  {
    id: "swot",
    label: "SWOT Analysis",
    description: "Strengths, weaknesses, opportunities, and threats overview",
    category: "direction_setting",
  },
  {
    id: "journey_map",
    label: "Customer Journey Map",
    description: "End-to-end customer journey with touchpoints, emotions, and opportunities",
    category: "direction_setting",
  },
  {
    id: "value_proposition",
    label: "Value Proposition Canvas",
    description: "Customer jobs, pains, gains mapped to product value propositions",
    category: "direction_setting",
  },
  {
    id: "positioning_statement",
    label: "Positioning Statement",
    description: "For/who/that/unlike positioning framework",
    category: "direction_setting",
  },
  {
    id: "brand_narrative",
    label: "Brand Narrative",
    description: "The overarching story that connects brand purpose to audience needs",
    category: "direction_setting",
  },
  {
    id: "channel_strategy",
    label: "Channel Strategy",
    description: "Channel prioritization, content mapping, and distribution plan",
    category: "direction_setting",
  },
  {
    id: "custom_direction",
    label: "Custom Artefact",
    description: "Custom direction setting artefact",
    category: "direction_setting",
  },
];

export function getArtefactType(typeId: string): ArtefactTypeDef | undefined {
  return ARTEFACT_TYPES.find((t) => t.id === typeId);
}

export function getResearchTypes(): ArtefactTypeDef[] {
  return ARTEFACT_TYPES.filter((t) => t.category === "research");
}

export function getDirectionSettingTypes(): ArtefactTypeDef[] {
  return ARTEFACT_TYPES.filter((t) => t.category === "direction_setting");
}

/** Fetches artefact types from the admin API (DB-backed). Falls back to hardcoded. */
export async function fetchArtefactTypes(): Promise<ArtefactTypeDef[]> {
  try {
    const res = await fetch("/api/admin/artefact-types");
    if (res.ok) {
      const data = await res.json();
      return data
        .filter((t: { enabled: boolean }) => t.enabled)
        .map((t: { typeId: string; label: string; description: string; category: string }) => ({
          id: t.typeId,
          label: t.label,
          description: t.description,
          category: t.category as "research" | "direction_setting",
        }));
    }
  } catch {
    // fallback
  }
  return ARTEFACT_TYPES;
}
