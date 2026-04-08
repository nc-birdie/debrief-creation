import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ typeId: string }> }
) {
  const { typeId } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.label !== undefined) data.label = body.label;
  if (body.description !== undefined) data.description = body.description;
  if (body.category !== undefined) data.category = body.category;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
  if (body.enabled !== undefined) data.enabled = body.enabled;
  if (body.instructions !== undefined) data.instructions = body.instructions;
  if (body.allowedTools !== undefined)
    data.allowedTools = JSON.stringify(body.allowedTools);
  if (body.maxTurns !== undefined) data.maxTurns = body.maxTurns;

  const updated = await prisma.artefactTypeDef.update({
    where: { id: typeId },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ typeId: string }> }
) {
  const { typeId } = await params;
  await prisma.artefactTypeDef.delete({ where: { id: typeId } });
  return NextResponse.json({ ok: true });
}
