import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ campaignId: string; artefactId: string }> }
) {
  const { artefactId } = await params;
  const artefact = await prisma.artefact.findUnique({
    where: { id: artefactId },
  });
  if (!artefact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(artefact);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ campaignId: string; artefactId: string }> }
) {
  const { artefactId } = await params;
  const body = await req.json();
  const allowed = ["name", "description", "content", "status", "type"];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) data[key] = body[key];
  }

  const artefact = await prisma.artefact.update({
    where: { id: artefactId },
    data,
  });

  return NextResponse.json(artefact);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ campaignId: string; artefactId: string }> }
) {
  const { artefactId } = await params;
  await prisma.artefact.delete({ where: { id: artefactId } });
  return NextResponse.json({ ok: true });
}
