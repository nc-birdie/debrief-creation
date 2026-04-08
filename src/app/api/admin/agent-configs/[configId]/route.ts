import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ configId: string }> }
) {
  const { configId } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.instructions !== undefined) data.instructions = body.instructions;
  if (body.maxTurns !== undefined) data.maxTurns = body.maxTurns;
  if (body.enabled !== undefined) data.enabled = body.enabled;

  const updated = await prisma.agentConfig.update({
    where: { id: configId },
    data,
  });

  return NextResponse.json(updated);
}
