import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ARTEFACT_TYPES } from "@/lib/artefact-types";
import { ARTEFACT_INSTRUCTIONS } from "@/lib/artefact-type-seeds";

export async function GET() {
  let types = await prisma.artefactTypeDef.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  // Auto-seed from hardcoded defaults on first access
  if (types.length === 0) {
    await prisma.artefactTypeDef.createMany({
      data: ARTEFACT_TYPES.map((t, i) => {
        const seed = ARTEFACT_INSTRUCTIONS[t.id];
        return {
          typeId: t.id,
          label: t.label,
          description: t.description,
          category: t.category,
          sortOrder: i,
          instructions: seed?.instructions ?? "",
          allowedTools: JSON.stringify(seed?.allowedTools ?? []),
          maxTurns: seed?.maxTurns ?? 10,
        };
      }),
    });
    types = await prisma.artefactTypeDef.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    });
  }

  return NextResponse.json(types);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.typeId || !body.label || !body.category) {
    return NextResponse.json(
      { error: "typeId, label, and category are required" },
      { status: 400 }
    );
  }

  // Calculate sort order
  const maxOrder = await prisma.artefactTypeDef.aggregate({
    where: { category: body.category },
    _max: { sortOrder: true },
  });

  const type = await prisma.artefactTypeDef.create({
    data: {
      typeId: body.typeId,
      label: body.label,
      description: body.description ?? "",
      category: body.category,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      instructions: body.instructions ?? "",
      allowedTools: JSON.stringify(body.allowedTools ?? []),
      maxTurns: body.maxTurns ?? 10,
    },
  });

  return NextResponse.json(type, { status: 201 });
}
