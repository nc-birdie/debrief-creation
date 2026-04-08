import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AGENT_CONFIG_SEEDS } from "@/lib/agent-config-seeds";

export async function GET() {
  let configs = await prisma.agentConfig.findMany({
    orderBy: { agentKey: "asc" },
  });

  // Auto-seed on first access
  if (configs.length === 0) {
    await prisma.agentConfig.createMany({
      data: AGENT_CONFIG_SEEDS.map((s) => ({
        agentKey: s.agentKey,
        name: s.name,
        description: s.description,
        instructions: s.instructions,
        maxTurns: s.maxTurns,
      })),
    });
    configs = await prisma.agentConfig.findMany({
      orderBy: { agentKey: "asc" },
    });
  }

  return NextResponse.json(configs);
}
