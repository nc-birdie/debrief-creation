import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeStepDef } from "@/lib/steps/definitions";
import { STEP_SEEDS } from "@/lib/steps/seed-data";

// GET all step definitions (auto-seeds on first call)
export async function GET() {
  let steps = await prisma.stepDef.findMany({
    orderBy: { number: "asc" },
  });

  if (steps.length === 0) {
    for (const seed of STEP_SEEDS) {
      await prisma.stepDef.create({
        data: {
          number: seed.number,
          title: seed.title,
          shortTitle: seed.shortTitle,
          description: seed.description,
          dependsOn: JSON.stringify(seed.dependsOn),
          promptHint: seed.promptHint,
          customInstructions: seed.customInstructions,
          outputFormat: seed.outputFormat,
          outputDisplay: seed.outputDisplay,
          allowedTools: JSON.stringify(seed.allowedTools),
          maxTurns: seed.maxTurns,
        },
      });
    }
    steps = await prisma.stepDef.findMany({
      orderBy: { number: "asc" },
    });
  }

  return NextResponse.json(steps.map(serializeStepDef));
}

// POST — create a new step
export async function POST(req: Request) {
  const body = await req.json();

  if (!body.title?.trim() || !body.shortTitle?.trim()) {
    return NextResponse.json(
      { error: "title and shortTitle are required" },
      { status: 400 }
    );
  }

  // Assign next number
  const maxNum = await prisma.stepDef.aggregate({
    _max: { number: true },
  });
  const nextNumber = (maxNum._max.number ?? 0) + 1;

  const step = await prisma.stepDef.create({
    data: {
      number: nextNumber,
      title: body.title.trim(),
      shortTitle: body.shortTitle.trim(),
      description: body.description?.trim() ?? "",
      dependsOn: JSON.stringify(body.dependsOn ?? []),
      promptHint: body.promptHint?.trim() ?? "",
      customInstructions: body.customInstructions?.trim() ?? "",
      outputFormat: body.outputFormat?.trim() ?? "",
      outputDisplay: body.outputDisplay ?? "prose",
      allowedTools: JSON.stringify(body.allowedTools ?? ["Read", "Glob", "Grep"]),
      maxTurns: body.maxTurns ?? 10,
    },
  });

  return NextResponse.json(serializeStepDef(step), { status: 201 });
}
