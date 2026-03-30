import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { serializeStepDef } from "@/lib/steps/definitions";

// PATCH — update a step definition
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ stepId: string }> }
) {
  const { stepId } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.shortTitle !== undefined) data.shortTitle = body.shortTitle;
  if (body.description !== undefined) data.description = body.description;
  if (body.dependsOn !== undefined)
    data.dependsOn = JSON.stringify(body.dependsOn);
  if (body.promptHint !== undefined) data.promptHint = body.promptHint;
  if (body.customInstructions !== undefined)
    data.customInstructions = body.customInstructions;
  if (body.outputFormat !== undefined) data.outputFormat = body.outputFormat;
  if (body.outputDisplay !== undefined)
    data.outputDisplay = body.outputDisplay;
  if (body.allowedTools !== undefined)
    data.allowedTools = JSON.stringify(body.allowedTools);
  if (body.maxTurns !== undefined) data.maxTurns = body.maxTurns;
  if (body.enabled !== undefined) data.enabled = body.enabled;
  if (body.number !== undefined) data.number = body.number;

  const step = await prisma.stepDef.update({
    where: { id: stepId },
    data,
  });

  return NextResponse.json(serializeStepDef(step));
}

// DELETE — remove a step
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ stepId: string }> }
) {
  const { stepId } = await params;

  const step = await prisma.stepDef.findUnique({ where: { id: stepId } });
  if (!step) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Remove this step's number from all other steps' dependsOn
  const allSteps = await prisma.stepDef.findMany();
  for (const s of allSteps) {
    const deps: number[] = JSON.parse(s.dependsOn);
    if (deps.includes(step.number)) {
      await prisma.stepDef.update({
        where: { id: s.id },
        data: {
          dependsOn: JSON.stringify(deps.filter((d) => d !== step.number)),
        },
      });
    }
  }

  await prisma.stepDef.delete({ where: { id: stepId } });

  // Re-number remaining steps to keep them sequential
  const remaining = await prisma.stepDef.findMany({
    orderBy: { number: "asc" },
  });
  for (let i = 0; i < remaining.length; i++) {
    const newNum = i + 1;
    if (remaining[i].number !== newNum) {
      // Update dependsOn references in all steps
      for (const s of remaining) {
        const deps: number[] = JSON.parse(s.dependsOn);
        if (deps.includes(remaining[i].number)) {
          const updated = deps.map((d) =>
            d === remaining[i].number ? newNum : d
          );
          await prisma.stepDef.update({
            where: { id: s.id },
            data: { dependsOn: JSON.stringify(updated) },
          });
        }
      }
      await prisma.stepDef.update({
        where: { id: remaining[i].id },
        data: { number: newNum },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
