import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      createdBy: { select: { id: true, username: true, displayName: true } },
    },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, slug, description } = body;

  if (!name || !slug) {
    return NextResponse.json(
      { error: "name and slug are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.campaign.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json(
      { error: "A campaign with this slug already exists" },
      { status: 409 }
    );
  }

  const user = await getCurrentUser();

  const campaign = await prisma.campaign.create({
    data: {
      name,
      slug,
      description: description ?? "",
      createdById: user.id,
    },
    include: {
      createdBy: { select: { id: true, username: true, displayName: true } },
    },
  });

  // Create step states for all enabled step definitions
  const stepDefs = await prisma.stepDef.findMany({
    where: { enabled: true },
    orderBy: { number: "asc" },
  });

  if (stepDefs.length > 0) {
    await prisma.stepState.createMany({
      data: stepDefs.map((def) => ({
        campaignId: campaign.id,
        stepNumber: def.number,
      })),
    });
  }

  return NextResponse.json(campaign, { status: 201 });
}
