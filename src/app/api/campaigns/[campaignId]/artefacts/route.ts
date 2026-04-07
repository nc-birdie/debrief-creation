import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const artefacts = await prisma.artefact.findMany({
    where: { campaignId },
    orderBy: [{ category: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(artefacts);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const body = await req.json();
  const { category, type, name, description, content } = body;

  if (!category || !type || !name) {
    return NextResponse.json(
      { error: "category, type, and name are required" },
      { status: 400 }
    );
  }

  const artefact = await prisma.artefact.create({
    data: {
      campaignId,
      category,
      type,
      name,
      description: description ?? "",
      content: content ?? "",
    },
  });

  return NextResponse.json(artefact, { status: 201 });
}
