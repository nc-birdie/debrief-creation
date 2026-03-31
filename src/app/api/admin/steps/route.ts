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

// POST — create a new step (supports optional insertAt for positioning)
export async function POST(req: Request) {
  const body = await req.json();

  if (!body.title?.trim() || !body.shortTitle?.trim()) {
    return NextResponse.json(
      { error: "title and shortTitle are required" },
      { status: 400 }
    );
  }

  const maxNum = await prisma.stepDef.aggregate({
    _max: { number: true },
  });
  const totalSteps = maxNum._max.number ?? 0;
  const insertAt =
    typeof body.insertAt === "number" && body.insertAt >= 1
      ? Math.min(body.insertAt, totalSteps + 1)
      : totalSteps + 1;

  // If inserting in the middle, shift existing steps down
  if (insertAt <= totalSteps) {
    // Shift to temp numbers to avoid unique constraint
    const toShift = await prisma.stepDef.findMany({
      where: { number: { gte: insertAt } },
      orderBy: { number: "desc" },
    });
    const offset = totalSteps + 100;
    for (const s of toShift) {
      await prisma.stepDef.update({
        where: { id: s.id },
        data: { number: offset + s.number },
      });
    }
    // Now shift to final numbers
    for (const s of toShift) {
      const newNum = s.number + 1;
      // Update dependsOn references: increment any dep >= insertAt
      const deps: number[] = JSON.parse(s.dependsOn);
      const updatedDeps = deps.map((d) => (d >= insertAt ? d + 1 : d));
      await prisma.stepDef.update({
        where: { id: s.id },
        data: {
          number: newNum,
          dependsOn: JSON.stringify(updatedDeps),
        },
      });
    }
    // Also update dependsOn in steps that weren't shifted
    const unshifted = await prisma.stepDef.findMany({
      where: { number: { lt: insertAt } },
    });
    for (const s of unshifted) {
      const deps: number[] = JSON.parse(s.dependsOn);
      const updatedDeps = deps.map((d) => (d >= insertAt ? d + 1 : d));
      if (JSON.stringify(deps) !== JSON.stringify(updatedDeps)) {
        await prisma.stepDef.update({
          where: { id: s.id },
          data: { dependsOn: JSON.stringify(updatedDeps) },
        });
      }
    }
  }

  const step = await prisma.stepDef.create({
    data: {
      number: insertAt,
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
