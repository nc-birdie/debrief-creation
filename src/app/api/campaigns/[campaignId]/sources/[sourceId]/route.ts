import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: Request,
  {
    params,
  }: { params: Promise<{ campaignId: string; sourceId: string }> }
) {
  const { sourceId } = await params;
  // Delete knowledge entries extracted from this source
  await prisma.knowledgeEntry.deleteMany({ where: { sourceId } });
  await prisma.source.delete({ where: { id: sourceId } });
  return NextResponse.json({ ok: true });
}
