import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Update category
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.label !== undefined) data.label = body.label;
  if (body.enabled !== undefined) data.enabled = body.enabled;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

  const category = await prisma.briefingCategory.update({
    where: { id: categoryId },
    data,
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json(category);
}

// Delete category (cascades questions)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await params;
  await prisma.briefingCategory.delete({ where: { id: categoryId } });
  return NextResponse.json({ ok: true });
}
