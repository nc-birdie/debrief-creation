import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  const body = await req.json();

  const agent = await prisma.subAgentDef.update({
    where: { id: agentId },
    data: {
      name: body.name,
      description: body.description ?? "",
      systemPrompt: body.systemPrompt ?? "",
      outputFormat: body.outputFormat ?? "",
    },
  });

  return NextResponse.json(agent);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  await prisma.subAgentDef.delete({ where: { id: agentId } });
  return NextResponse.json({ ok: true });
}
