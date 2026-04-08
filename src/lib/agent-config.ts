import { prisma } from "@/lib/db";
import { areasForPrompt } from "@/lib/knowledge-areas";
import { AGENT_CONFIG_SEEDS } from "@/lib/agent-config-seeds";

/**
 * Load an agent config from the database, auto-seeding if needed.
 * Replaces the {{KNOWLEDGE_AREAS}} placeholder with the current area definitions.
 */
export async function getAgentConfig(agentKey: string): Promise<{
  instructions: string;
  maxTurns: number;
  enabled: boolean;
}> {
  let config = await prisma.agentConfig.findUnique({
    where: { agentKey },
  });

  // Auto-seed if not found
  if (!config) {
    const seed = AGENT_CONFIG_SEEDS.find((s) => s.agentKey === agentKey);
    if (seed) {
      config = await prisma.agentConfig.create({
        data: {
          agentKey: seed.agentKey,
          name: seed.name,
          description: seed.description,
          instructions: seed.instructions,
          maxTurns: seed.maxTurns,
        },
      });
    }
  }

  const instructions = (config?.instructions ?? "")
    .replace(/\{\{KNOWLEDGE_AREAS\}\}/g, areasForPrompt());

  return {
    instructions,
    maxTurns: config?.maxTurns ?? 10,
    enabled: config?.enabled ?? true,
  };
}
