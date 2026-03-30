import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ campaignId: string; entryId: string }> }
) {
  const { entryId } = await params;
  const body = await req.json();

  const data: Record<string, string> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.content !== undefined) data.content = body.content;
  if (body.area !== undefined) data.area = body.area;

  const entry = await prisma.knowledgeEntry.update({
    where: { id: entryId },
    data,
  });

  return NextResponse.json(entry);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ campaignId: string; entryId: string }> }
) {
  const { entryId } = await params;
  await prisma.knowledgeEntry.delete({ where: { id: entryId } });
  return NextResponse.json({ ok: true });
}
