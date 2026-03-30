export interface BriefingQuestion {
  id: string;
  question: string;
}

export interface BriefingCategory {
  id: string;
  label: string;
  questions: BriefingQuestion[];
}

export const BRIEFING_FRAMEWORK: BriefingCategory[] = [
  {
    id: "objectives_kpis",
    label: "Objectives and KPIs",
    questions: [
      { id: "obj-1", question: "What are the primary objectives of this initiative?" },
      { id: "obj-2", question: "Are we focused on new customer acquisition, pipeline improvement, or existing customer growth?" },
      { id: "obj-3", question: "How do we define success in concrete terms?" },
      { id: "obj-4", question: "What KPIs can we assign to each objective?" },
      { id: "obj-5", question: "Can we quantify targets such as sales, meetings booked, pipeline value, or deal size?" },
    ],
  },
  {
    id: "icp",
    label: "Target Audience — Ideal Customer Profile (ICP)",
    questions: [
      { id: "icp-1", question: "What is the company size?" },
      { id: "icp-2", question: "How old is the company?" },
      { id: "icp-3", question: "How mature is the company?" },
      { id: "icp-4", question: "What is their annual revenue?" },
      { id: "icp-5", question: "Where is the company located?" },
      { id: "icp-6", question: "Which industries does the company operate in?" },
      { id: "icp-7", question: "Which technologies does the company use?" },
      { id: "icp-8", question: "What market position does the company hold?" },
      { id: "icp-9", question: "How is the company organized?" },
    ],
  },
  {
    id: "icp_pain_points",
    label: "Target Audience — ICP Pain Points & Outcomes",
    questions: [
      { id: "icp-pp-1", question: "Which pain points are we solving for the customer?" },
      { id: "icp-pp-2", question: "What short-term goals do we help them achieve?" },
      { id: "icp-pp-3", question: "What long-term goals do we help them achieve?" },
    ],
  },
  {
    id: "buying_process",
    label: "Target Audience — Buying Process",
    questions: [
      { id: "bp-1", question: "Where did customers research before reaching out?" },
      { id: "bp-2", question: "Where did they research before buying?" },
      { id: "bp-3", question: "Why did they decide to buy?" },
    ],
  },
  {
    id: "ibp",
    label: "Target Audience — Ideal Buying Persona (IBP)",
    questions: [
      { id: "ibp-1", question: "Which job titles and roles are involved?" },
      { id: "ibp-2", question: "What seniority levels are involved?" },
      { id: "ibp-3", question: "Does age or gender influence the buying process?" },
      { id: "ibp-4", question: "Which media channels do they use?" },
    ],
  },
  {
    id: "ibp_pain_points",
    label: "Target Audience — IBP Pain Points & Outcomes",
    questions: [
      { id: "ibp-pp-1", question: "Which pain points are we solving for the individual?" },
      { id: "ibp-pp-2", question: "What short-term goals do we help them achieve?" },
      { id: "ibp-pp-3", question: "What long-term goals do we help them achieve?" },
    ],
  },
  {
    id: "buying_dynamics",
    label: "Target Audience — Buying Dynamics",
    questions: [
      { id: "bd-1", question: "How many decision makers are involved?" },
      { id: "bd-2", question: "Who acts as champion?" },
      { id: "bd-3", question: "Who is the decision maker?" },
      { id: "bd-4", question: "Who is the blocker?" },
      { id: "bd-5", question: "Do we have access to customer interviews?" },
    ],
  },
  {
    id: "customer_journey",
    label: "Customer Journey & Audience Movement",
    questions: [
      { id: "cj-1", question: "What triggers movement from one stage to another?" },
      { id: "cj-2", question: "What does the buyer need at each stage?" },
      { id: "cj-3", question: "How do they research solutions?" },
      { id: "cj-4", question: "How do they evaluate options?" },
      { id: "cj-5", question: "What information do they require to decide?" },
    ],
  },
  {
    id: "strategic_direction",
    label: "Strategic Direction",
    questions: [
      { id: "sd-1", question: "Where do we want the audience to go long term?" },
      { id: "sd-2", question: "Where do we want them to go short term?" },
      { id: "sd-3", question: "Where are they today in relation to us?" },
    ],
  },
  {
    id: "industry_insights",
    label: "Industry Insights",
    questions: [
      { id: "ii-1", question: "What is the history of the industry?" },
      { id: "ii-2", question: "What drives or limits industry growth?" },
      { id: "ii-3", question: "Are there relevant regulations?" },
      { id: "ii-4", question: "What is the size of the industry?" },
      { id: "ii-5", question: "What is our current share?" },
      { id: "ii-6", question: "What is our target share?" },
      { id: "ii-7", question: "How much share is realistically available?" },
      { id: "ii-8", question: "How have sales trends developed over time?" },
      { id: "ii-9", question: "Will the industry grow or decline?" },
      { id: "ii-10", question: "How sensitive is the industry to external factors?" },
      { id: "ii-11", question: "What are the key management trends?" },
      { id: "ii-12", question: "Who are the key industry leaders?" },
      { id: "ii-13", question: "How do market dynamics function?" },
    ],
  },
  {
    id: "market_competitive",
    label: "Market & Competitive Insights",
    questions: [
      { id: "mc-1", question: "Who are the market leaders?" },
      { id: "mc-2", question: "Who are our top competitors?" },
      { id: "mc-3", question: "What market share do competitors hold?" },
      { id: "mc-4", question: "What share can we realistically take?" },
      { id: "mc-5", question: "How do competitors differentiate themselves?" },
      { id: "mc-6", question: "Where are competitors focused geographically or segment-wise?" },
      { id: "mc-7", question: "Are competitors perceived as more authoritative?" },
      { id: "mc-8", question: "How is our brand performing compared to competitors?" },
      { id: "mc-9", question: "How do competitors attract customers?" },
      { id: "mc-10", question: "Which marketing strategies do they use?" },
      { id: "mc-11", question: "Which channels drive traffic for them?" },
      { id: "mc-12", question: "What content performs well for them?" },
      { id: "mc-13", question: "What are competitors doing that we are not?" },
    ],
  },
  {
    id: "product_insights",
    label: "Product Insights",
    questions: [
      { id: "pi-1", question: "What type of product is offered in the industry?" },
      { id: "pi-2", question: "What products do competitors offer?" },
      { id: "pi-3", question: "What alternatives could customers choose instead of us?" },
      { id: "pi-4", question: "How easy is it to switch between providers?" },
      { id: "pi-5", question: "What factors influence switching decisions?" },
      { id: "pi-6", question: "How does our business model compare to competitors?" },
    ],
  },
  {
    id: "timing_external",
    label: "Timing & External Factors",
    questions: [
      { id: "te-1", question: "Are there key events like trade shows affecting timing?" },
      { id: "te-2", question: "Is there seasonality in buyer readiness?" },
      { id: "te-3", question: "Are there upcoming regulations or external changes?" },
    ],
  },
  {
    id: "value_proposition",
    label: "Value Proposition Clarity",
    questions: [
      { id: "vp-1", question: "What exactly are we selling?" },
      { id: "vp-2", question: "How does the product or service work?" },
      { id: "vp-3", question: "What does the name represent if relevant?" },
      { id: "vp-4", question: "What are the key product details or assets available?" },
      { id: "vp-5", question: "What is our unique value proposition?" },
      { id: "vp-6", question: "What makes the product different?" },
      { id: "vp-7", question: "Does the value proposition vary by segment or persona?" },
      { id: "vp-8", question: "Who are our competitors in this context?" },
      { id: "vp-9", question: "What are the pros and cons of our offering?" },
      { id: "vp-10", question: "Who are we selling to?" },
      { id: "vp-11", question: "Why does the market need this product?" },
      { id: "vp-12", question: "Which pain points does the product address?" },
    ],
  },
  {
    id: "messaging_proof",
    label: "Messaging & Proof",
    questions: [
      { id: "mp-1", question: "What is our core umbrella message?" },
      { id: "mp-2", question: "How do we support the business proposition with proof?" },
      { id: "mp-3", question: "What product proof points do we have?" },
      { id: "mp-4", question: "What partner or delivery proof points do we have?" },
    ],
  },
  {
    id: "budget_execution",
    label: "Budget & Execution Frame",
    questions: [
      { id: "be-1", question: "What is the consultancy budget?" },
      { id: "be-2", question: "What is the production budget?" },
      { id: "be-3", question: "What is the operational budget?" },
      { id: "be-4", question: "What is the media budget?" },
      { id: "be-5", question: "What is the go-live date?" },
      { id: "be-6", question: "What are the key milestones?" },
      { id: "be-7", question: "What is the campaign period?" },
    ],
  },
];

export const TOTAL_QUESTIONS = BRIEFING_FRAMEWORK.reduce(
  (sum, cat) => sum + cat.questions.length,
  0
);

// For the AI prompt
export function briefingQuestionsForPrompt(): string {
  return BRIEFING_FRAMEWORK.map((cat) => {
    const qs = cat.questions
      .map((q) => `  - [${q.id}] ${q.question}`)
      .join("\n");
    return `### ${cat.label}\n${qs}`;
  }).join("\n\n");
}
