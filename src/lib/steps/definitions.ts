// Step definitions are now stored in the database (StepDef model).
// This file exports the TypeScript interface and DB-loading helpers for server-side use.

export interface StepDefinition {
  id: string;
  number: number;
  title: string;
  shortTitle: string;
  description: string;
  dependsOn: number[];
  promptHint: string;
  customInstructions: string;
  outputFormat: string;
  outputDisplay: string;
  allowedTools: string[];
  maxTurns: number;
  enabled: boolean;
}

// Serialize a DB StepDef row into the frontend-friendly StepDefinition shape
export function serializeStepDef(row: {
  id: string;
  number: number;
  title: string;
  shortTitle: string;
  description: string;
  dependsOn: string;
  promptHint: string;
  customInstructions: string;
  outputFormat: string;
  outputDisplay: string;
  allowedTools: string;
  maxTurns: number;
  enabled: boolean;
}): StepDefinition {
  return {
    ...row,
    dependsOn: JSON.parse(row.dependsOn),
    allowedTools: JSON.parse(row.allowedTools),
  };
}
