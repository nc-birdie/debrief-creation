import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Update question
export async function PATCH(
  req: Request,
  {
    params,
  }: { params: Promise<{ categoryId: string; questionId: string }> }
) {
  const { questionId } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.question !== undefined) data.question = body.question;
  if (body.enabled !== undefined) data.enabled = body.enabled;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

  const question = await prisma.briefingTemplateQuestion.update({
    where: { id: questionId },
    data,
  });

  return NextResponse.json(question);
}

// Delete question
export async function DELETE(
  _req: Request,
  {
    params,
  }: { params: Promise<{ categoryId: string; questionId: string }> }
) {
  const { questionId } = await params;
  await prisma.briefingTemplateQuestion.delete({
    where: { id: questionId },
  });
  return NextResponse.json({ ok: true });
}
