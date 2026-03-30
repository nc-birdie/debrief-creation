// Default admin configurations for all 13 steps

export interface StepConfigDefault {
  stepNumber: number;
  customInstructions: string;
  outputFormat: string;
  outputDisplay: string;
  allowedTools: string[];
  maxTurns: number;
}

export const STEP_CONFIG_DEFAULTS: StepConfigDefault[] = [
  {
    stepNumber: 1,
    outputDisplay: "prose",
    allowedTools: ["Read", "Glob", "Grep"],
    maxTurns: 10,
    customInstructions: `Define the campaign task clearly and concisely. Cover:
- What is the specific initiative, launch, or campaign we are setting direction for?
- What triggered this work? (client request, market opportunity, product launch, competitive pressure)
- What is the scope? (regions, products, timeframe, budget range)
- What is explicitly out of scope?
- Who are the key stakeholders?`,
    outputFormat: `Write a clear, structured narrative with these sections:
## Initiative Overview
A 2-3 sentence summary of the task.
## Trigger & Background
What prompted this work.
## Scope
What's included and what's not.
## Stakeholders
Key people and their roles.
## Timeline
Key dates and milestones if known.`,
  },
  {
    stepNumber: 2,
    outputDisplay: "prose",
    allowedTools: ["Read", "Glob", "Grep"],
    maxTurns: 10,
    customInstructions: `Trace the origin story of the product or offering. Focus on:
- What market need or customer pain led to its creation?
- What was the founding insight?
- How has the product evolved since its initial conception?
- What strategic vision does it serve within the company's portfolio?`,
    outputFormat: `Write a narrative covering:
## The Market Gap
What need existed before this product.
## The Founding Insight
The key realization that led to development.
## Evolution
How the product has evolved over time.
## Strategic Role
Where this fits in the company's broader portfolio and vision.`,
  },
  {
    stepNumber: 3,
    outputDisplay: "bullet-cards",
    allowedTools: ["Read", "Glob", "Grep"],
    maxTurns: 10,
    customInstructions: `Identify all timing drivers and urgency factors. Consider:
- Market shifts (demand changes, adoption curves, emerging trends)
- Regulatory changes (new laws, compliance deadlines, policy shifts)
- Competitive pressure (new entrants, competitor launches, market consolidation)
- Internal readiness (product maturity, team capacity, budget cycles)
- Customer demand signals (inbound requests, RFP patterns, analyst mentions)
- External events (trade shows, industry cycles, economic conditions)`,
    outputFormat: `Structure as a list of urgency drivers. For each driver use:
### [Driver Name]
**Type:** Market | Regulatory | Competitive | Internal | Customer | External
**Urgency:** High | Medium | Low
**Timeline:** When this becomes critical
[2-3 sentence description of why this creates urgency now]`,
  },
  {
    stepNumber: 4,
    outputDisplay: "kpi-grid",
    allowedTools: ["Read", "Glob", "Grep"],
    maxTurns: 10,
    customInstructions: `Define concrete, measurable objectives. For each objective:
- State it clearly and specifically
- Assign 1-2 KPIs with target values
- Define the timeframe
- Categorize as: Pipeline | Revenue | Awareness | Positioning | Engagement
- Flag if the target is aspirational vs. data-backed`,
    outputFormat: `Structure as a list of objectives. For each use:
### [Objective Name]
**Category:** Pipeline | Revenue | Awareness | Positioning | Engagement
**KPI:** [Metric name]
**Target:** [Specific number or range]
**Timeframe:** [When]
**Confidence:** High | Medium | Low (is this target data-backed or aspirational?)
[1-2 sentence description]`,
  },
  {
    stepNumber: 5,
    outputDisplay: "bullet-cards",
    allowedTools: ["Read", "Glob", "Grep"],
    maxTurns: 10,
    customInstructions: `Document every technical capability and differentiator. Be specific:
- What does the product actually DO technically?
- How does it work differently from alternatives?
- What are the performance characteristics?
- What technical advantages does it provide?
- What are the integration points and compatibility?
Group capabilities into logical clusters.`,
    outputFormat: `Structure as capability cards. For each use:
### [Capability Name]
**Category:** Core | Differentiator | Integration | Performance
**What it does:** [1 sentence, plain language]
**How it works:** [Technical explanation, 2-3 sentences]
**Why it matters:** [Business impact, 1-2 sentences]
**Differentiator:** [How this compares to alternatives]`,
  },
  {
    stepNumber: 6,
    outputDisplay: "bullet-cards",
    allowedTools: ["Read", "Glob", "Grep"],
    maxTurns: 10,
    customInstructions: `Map technical capabilities to real business problems. For each problem:
- Describe the pain in the customer's language (not product language)
- Quantify the impact where possible (cost, time, risk)
- Explain how the product solves it specifically
- Note which customer segments feel this pain most acutely
- Rate problem severity: Critical | Significant | Nice-to-have`,
    outputFormat: `Structure as problem cards. For each use:
### [Business Problem]
**Severity:** Critical | Significant | Nice-to-have
**Who feels it:** [Which segments/roles]
**The pain:** [Description in customer language, 2-3 sentences]
**Impact:** [Quantified where possible — cost, time, risk]
**How we solve it:** [Specific capabilities that address this]`,
  },
  {
    stepNumber: 7,
    outputDisplay: "bullet-cards",
    allowedTools: ["Read", "Glob", "Grep"],
    maxTurns: 10,
    customInstructions: `Be honest and strategic about where this product is NOT the best fit. Cover:
- At what scale, context, or use case are other solutions better?
- Which competing products (including from the same company) win in specific scenarios?
- What are the genuine technical or commercial limitations?
- Where should sales NOT pursue or should defer to partners/alternatives?
This is critical for positioning credibility.`,
    outputFormat: `Structure as boundary cards. For each use:
### [Scenario Where We're Not Best Fit]
**Better alternative:** [What solution is more relevant here]
**Why:** [Honest explanation, 2-3 sentences]
**Scale/Context:** [When does this apply — e.g. "above X capacity", "in regions without Y"]
**Recommendation:** [What should the sales/marketing team do in this case]`,
  },
  {
    stepNumber: 8,
    outputDisplay: "bullet-cards",
    allowedTools: ["Read", "Glob", "Grep"],
    maxTurns: 10,
    customInstructions: `Identify everything that must be in place for a customer to adopt and benefit. Categories:
- Infrastructure prerequisites (energy, connectivity, physical space)
- Organizational prerequisites (team, skills, processes, budget approval)
- Technical prerequisites (existing systems, data, integrations)
- Regulatory prerequisites (permits, certifications, compliance)
- Commercial prerequisites (contracts, partnerships, procurement)`,
    outputFormat: `Structure as prerequisite cards. For each use:
### [Prerequisite]
**Category:** Infrastructure | Organizational | Technical | Regulatory | Commercial
**Criticality:** Must-have | Should-have | Nice-to-have
**Description:** [What exactly needs to be in place, 2-3 sentences]
**Implication:** [What happens if this isn't met — deal blocker? Delayed value? Higher cost?]`,
  },
  {
    stepNumber: 9,
    outputDisplay: "table",
    allowedTools: ["Read", "Glob", "Grep", "WebSearch", "WebFetch"],
    maxTurns: 15,
    customInstructions: `Identify and prioritize customer segments that experience the business problems from Step 6. For each segment:
- Define the segment clearly (industry, company type, size, characteristics)
- Assess problem urgency (how acutely they feel the pain)
- Assess solution fit (how well our product matches their needs)
- Assess prerequisites readiness (how likely they are to have prerequisites in place)
- Estimate segment size and accessibility
- Note any existing customer proof points in this segment`,
    outputFormat: `Present as a prioritized table:

| Segment | Industry | Size Profile | Problem Urgency | Solution Fit | Prerequisites Met | Priority | Proof Points |
|---------|----------|-------------|-----------------|-------------|-------------------|----------|-------------|
| [Name] | [Industry] | [Size range] | High/Med/Low | High/Med/Low | High/Med/Low | Tier 1/2/3 | [Yes/No + detail] |

After the table, add a brief paragraph for each Tier 1 segment explaining the rationale.`,
  },
  {
    stepNumber: 10,
    outputDisplay: "table",
    allowedTools: ["Read", "Glob", "Grep", "WebSearch", "WebFetch"],
    maxTurns: 15,
    customInstructions: `Map business problems to geographies. Assess each geography on:
- Regulatory environment (are regulations driving adoption?)
- Market maturity (how established is the market for this type of solution?)
- Infrastructure readiness (do customers have the prerequisites?)
- Competitive intensity (how crowded is the market here?)
- Segment density (how many target accounts exist?)
- Strategic fit (does the company have presence/capability here?)`,
    outputFormat: `Present as a prioritized table:

| Geography | Regulatory Driver | Market Maturity | Infra Readiness | Competition | Segment Density | Priority | Key Consideration |
|-----------|------------------|-----------------|-----------------|-------------|-----------------|----------|-------------------|
| [Region/Country] | Strong/Moderate/Weak | Early/Growing/Mature | High/Med/Low | High/Med/Low | High/Med/Low | Tier 1/2/3 | [One-liner] |

After the table, add a brief paragraph for each Tier 1 geography.`,
  },
  {
    stepNumber: 11,
    outputDisplay: "table",
    allowedTools: ["Read", "Glob", "Grep", "WebSearch", "WebFetch"],
    maxTurns: 15,
    customInstructions: `Size the opportunity for each prioritized segment × geography combination. Include:
- Total Addressable Market (TAM): theoretical maximum
- Serviceable Addressable Market (SAM): what we could realistically reach
- Serviceable Obtainable Market (SOM): what we can win in 12-24 months
- Average deal size assumptions
- Sales cycle length
- Confidence level in the estimates
Flag clearly where data is insufficient and estimates are rough.`,
    outputFormat: `Present as a market sizing table:

| Segment | Geography | TAM | SAM | SOM (12-24mo) | Avg Deal Size | Cycle Length | Confidence | Data Source |
|---------|-----------|-----|-----|---------------|---------------|--------------|------------|-------------|
| [Segment] | [Geo] | [$X] | [$X] | [$X] | [$X] | [X months] | High/Med/Low | [Source or "Estimate"] |

After the table, add notes on methodology and key assumptions.`,
  },
  {
    stepNumber: 12,
    outputDisplay: "table",
    allowedTools: ["Read", "Glob", "Grep", "WebSearch", "WebFetch"],
    maxTurns: 15,
    customInstructions: `Map the competitive landscape for each prioritized segment and geography. For each competitor:
- What is their approach and positioning?
- What are their strengths and weaknesses relative to us?
- Where do they focus geographically and by segment?
- What is their pricing model?
- What is their market traction?
- How do they go to market (direct, channel, digital)?
Include both direct competitors and alternative approaches customers might choose.`,
    outputFormat: `Present as a competitor comparison table:

| Competitor | Approach | Key Strength | Key Weakness | Geo Focus | Segment Focus | Pricing Model | Market Traction | Threat Level |
|-----------|----------|-------------|-------------|-----------|---------------|---------------|-----------------|-------------|
| [Name] | [1 sentence] | [1 sentence] | [1 sentence] | [Regions] | [Segments] | [Model] | [Traction] | High/Med/Low |

After the table, write a "Competitive Positioning Summary" paragraph covering our key differentiators and where we win vs. lose.`,
  },
  {
    stepNumber: 13,
    outputDisplay: "statement-cards",
    allowedTools: ["Read"],
    maxTurns: 10,
    customInstructions: `Synthesize all prior steps into actionable "Get to, by" direction statements. For each priority segment × geography combination, write a statement following this framework:

**Get** [specific target audience/segment]
**To** [desired action, belief, or behavior change]
**By** [specific method, channel, message, or approach]

Each statement should be:
- Specific enough to brief a creative team
- Grounded in the insights from prior steps
- Actionable within the campaign timeframe
- Measurable against the KPIs from Step 4`,
    outputFormat: `Structure as strategy statements. For each use:

### [Segment] — [Geography]
**Get** [who — be specific about the audience within the segment]
**To** [what — the desired action or belief shift]
**By** [how — specific channels, messages, tactics, proof points to use]

**Priority:** Primary | Secondary
**Linked KPIs:** [Which KPIs from Step 4 this drives]
**Key Message Angle:** [The core message hook, 1 sentence]
**Primary Channels:** [Top 2-3 channels for this audience]`,
  },
];
