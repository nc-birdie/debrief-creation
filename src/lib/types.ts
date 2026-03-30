// Domain types derived from Prisma models + step definitions

export type CampaignStatus = "setup" | "in_progress" | "completed";

export type StepStatus =
  | "pending"
  | "generating"
  | "review"
  | "approved"
  | "skipped";

export type AgentRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type AgentRunPhase = "generate" | "research" | "refine";

export type SourceFileType = "text" | "pdf" | "markdown" | "notes";

export interface KnowledgeGap {
  id: string;
  title: string;
  description: string;
  category: "source_needed" | "research_needed" | "decision_needed";
  resolved: boolean;
  resolution?: string;
}

export interface Decision {
  id: string;
  title: string;
  description: string;
  options: string[];
  recommendation: string;
  reasoning: string;
  chosen?: string;
}

export interface Campaign {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: CampaignStatus;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
  sources?: Source[];
  steps?: StepState[];
}

export interface Source {
  id: string;
  campaignId: string;
  name: string;
  filePath: string;
  fileType: SourceFileType;
  sizeBytes: number;
  summary: string | null;
  ingested: boolean;
  createdAt: string;
}

export interface StepState {
  id: string;
  campaignId: string;
  stepNumber: number;
  status: StepStatus;
  aiDraft: string | null;
  userEdits: string | null;
  finalOutput: string | null;
  knowledgeGaps: KnowledgeGap[];
  decisions: Decision[];
  generatedAt: string | null;
  approvedAt: string | null;
  updatedAt: string;
}

export interface AgentRun {
  id: string;
  campaignId: string;
  stepNumber: number;
  phase: AgentRunPhase;
  status: AgentRunStatus;
  turnsUsed: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface KnowledgeEntry {
  id: string;
  campaignId: string;
  area: string;
  title: string;
  content: string;
  sourceId: string | null;
  sourceName?: string;
  createdAt: string;
  updatedAt: string;
}

// Brief assessment
export type CoverageStatus = "covered" | "partial" | "gap";

export interface QuestionAssessment {
  questionId: string;
  status: CoverageStatus;
  evidence: string; // what we know or why it's a gap
  entryIds: string[]; // which knowledge entries support this
}

export interface CategoryAssessment {
  categoryId: string;
  questions: QuestionAssessment[];
}

export interface BriefAssessment {
  categories: CategoryAssessment[];
  overallScore: number; // 0-100
  summary: string;
  assessedAt: string;
}

// Step mutations
export type StepMutation =
  | { type: "user-edit"; content: string }
  | { type: "approve" }
  | { type: "resolve-gap"; gapId: string; resolution: string }
  | { type: "dismiss-gap"; gapId: string }
  | { type: "decide"; decisionId: string; chosen: string };
