export interface KnowledgeAreaDef {
  id: string;
  label: string;
  description: string;
}

export const KNOWLEDGE_AREAS: KnowledgeAreaDef[] = [
  {
    id: "product_technology",
    label: "Product & Technology",
    description:
      "Product capabilities, technical specifications, differentiators, how it works, architecture, performance characteristics",
  },
  {
    id: "market_context",
    label: "Market Context",
    description:
      "Market trends, industry dynamics, regulatory environment, macro shifts, market maturity, adoption curves",
  },
  {
    id: "customer_pain_points",
    label: "Customer Pain Points",
    description:
      "Problems customers face, unmet needs, frustrations, workflow bottlenecks, cost pressures, operational challenges",
  },
  {
    id: "competitive_landscape",
    label: "Competitive Landscape",
    description:
      "Competitors, alternative solutions, positioning, win/loss patterns, market share, competitive advantages and disadvantages",
  },
  {
    id: "business_model",
    label: "Business Model & GTM",
    description:
      "Pricing, go-to-market approach, channels, partnerships, revenue model, sales motion, customer acquisition",
  },
  {
    id: "data_metrics",
    label: "Data & Metrics",
    description:
      "Numbers, statistics, market sizing, benchmarks, performance data, ROI figures, case study results",
  },
  {
    id: "strategic_context",
    label: "Strategic Context",
    description:
      "Vision, goals, strategic positioning, brand narrative, value propositions, messaging pillars, long-term direction",
  },
  {
    id: "regulatory_compliance",
    label: "Regulatory & Compliance",
    description:
      "Regulations, compliance requirements, certifications, legal considerations, standards, policy drivers",
  },
  {
    id: "organizational",
    label: "Organizational Context",
    description:
      "Team structure, capabilities, resources, internal constraints, stakeholders, decision-making, culture",
  },
  {
    id: "other",
    label: "Other Insights",
    description:
      "Insights that don't fit neatly into the other categories but may be relevant to campaign direction",
  },
];

export function getAreaLabel(areaId: string): string {
  return KNOWLEDGE_AREAS.find((a) => a.id === areaId)?.label ?? areaId;
}

export function getArea(areaId: string): KnowledgeAreaDef | undefined {
  return KNOWLEDGE_AREAS.find((a) => a.id === areaId);
}

// For use in AI prompts — describes all areas so the model knows how to categorize
export function areasForPrompt(): string {
  return KNOWLEDGE_AREAS.map(
    (a) => `- "${a.id}": ${a.label} — ${a.description}`
  ).join("\n");
}
