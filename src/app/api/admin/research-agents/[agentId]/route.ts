import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * PATCH /api/admin/research-agents/[agentId]
 * Update a research agent's configuration.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.instructions !== undefined) data.instructions = body.instructions;
  if (body.allowedTools !== undefined)
    data.allowedTools = JSON.stringify(body.allowedTools);
  if (body.maxTurns !== undefined) data.maxTurns = body.maxTurns;
  if (body.enabled !== undefined) data.enabled = body.enabled;

  const agent = await prisma.researchAgentDef.update({
    where: { id: agentId },
    data,
    include: {
      category: { select: { id: true, label: true, sortOrder: true, enabled: true } },
    },
  });

  return NextResponse.json({
    ...agent,
    allowedTools: JSON.parse(agent.allowedTools) as string[],
  });
}
