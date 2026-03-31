import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeStepDef } from "@/lib/steps/definitions";

/**
 * POST /api/admin/steps/reorder
 * Body: { stepId: string, newNumber: number }
 *
 * Moves a step to a new position and shifts all others accordingly.
 * Also updates dependsOn references across all steps.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const { stepId, newNumber } = body;

  if (!stepId || typeof newNumber !== "number" || newNumber < 1) {
    return NextResponse.json(
      { error: "stepId and newNumber (>= 1) are required" },
      { status: 400 }
    );
  }

  const step = await prisma.stepDef.findUnique({ where: { id: stepId } });
  if (!step) {
    return NextResponse.json({ error: "Step not found" }, { status: 404 });
  }

  const allSteps = await prisma.stepDef.findMany({
    orderBy: { number: "asc" },
  });

  const maxNumber = allSteps.length;
  const targetNumber = Math.min(newNumber, maxNumber);
  const oldNumber = step.number;

  if (oldNumber === targetNumber) {
    return NextResponse.json(allSteps.map(serializeStepDef));
  }

  // Build a mapping from old number -> new number
  const numberMap = new Map<number, number>();

  for (const s of allSteps) {
    let num = s.number;
    if (s.id === stepId) {
      num = targetNumber;
    } else if (oldNumber < targetNumber) {
      // Moving down: steps between old+1..target shift up by 1
      if (s.number > oldNumber && s.number <= targetNumber) {
        num = s.number - 1;
      }
    } else {
      // Moving up: steps between target..old-1 shift down by 1
      if (s.number >= targetNumber && s.number < oldNumber) {
        num = s.number + 1;
      }
    }
    numberMap.set(s.number, num);
  }

  // Use a temp offset to avoid unique constraint violations
  const offset = maxNumber + 100;

  // Phase 1: move all to temporary numbers
  for (const s of allSteps) {
    const newNum = numberMap.get(s.number)!;
    if (s.number !== newNum) {
      await prisma.stepDef.update({
        where: { id: s.id },
        data: { number: offset + newNum },
      });
    }
  }

  // Phase 2: move from temp to final numbers + update dependsOn references
  for (const s of allSteps) {
    const newNum = numberMap.get(s.number)!;
    const deps: number[] = JSON.parse(s.dependsOn);
    const updatedDeps = deps.map((d) => numberMap.get(d) ?? d);

    if (s.number !== newNum) {
      await prisma.stepDef.update({
        where: { id: s.id },
        data: {
          number: newNum,
          dependsOn: JSON.stringify(updatedDeps),
        },
      });
    } else if (JSON.stringify(deps) !== JSON.stringify(updatedDeps)) {
      await prisma.stepDef.update({
        where: { id: s.id },
        data: { dependsOn: JSON.stringify(updatedDeps) },
      });
    }
  }

  const updated = await prisma.stepDef.findMany({
    orderBy: { number: "asc" },
  });

  return NextResponse.json(updated.map(serializeStepDef));
}
