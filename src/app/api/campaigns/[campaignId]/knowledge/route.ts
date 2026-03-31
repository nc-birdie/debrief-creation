import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;

  const entries = await prisma.knowledgeEntry.findMany({
    where: { campaignId },
    include: { source: { select: { name: true } } },
    orderBy: [{ area: "asc" }, { createdAt: "asc" }],
  });

  // Add sourceName for convenience
  const result = entries.map((e) => ({
    ...e,
    sourceName: e.source?.name ?? null,
    source: undefined,
  }));

  return NextResponse.json(result);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const body = await req.json();

  // Bulk import: body.entries is an array
  if (Array.isArray(body.entries)) {
    const valid = body.entries.filter(
      (e: Record<string, unknown>) => e.area && e.title && e.content
    );
    if (valid.length === 0) {
      return NextResponse.json({ error: "No valid entries" }, { status: 400 });
    }
    await prisma.knowledgeEntry.createMany({
      data: valid.map((e: { area: string; title: string; content: string }) => ({
        campaignId,
        area: e.area,
        title: e.title,
        content: e.content,
      })),
    });
    return NextResponse.json({ imported: valid.length }, { status: 201 });
  }

  // Single entry
  if (!body.area || !body.title || !body.content) {
    return NextResponse.json(
      { error: "area, title, and content are required" },
      { status: 400 }
    );
  }

  const entry = await prisma.knowledgeEntry.create({
    data: {
      campaignId,
      area: body.area,
      title: body.title,
      content: body.content,
      sourceId: body.sourceId ?? null,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
