import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user";
import { prisma } from "@/lib/db";

// GET — return the current OS user (auto-creates on first call)
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json(user);
}

// PATCH — update display name
export async function PATCH(req: Request) {
  const current = await getCurrentUser();
  const body = await req.json();

  if (!body.displayName?.trim()) {
    return NextResponse.json(
      { error: "displayName is required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id: current.id },
    data: { displayName: body.displayName.trim() },
  });

  return NextResponse.json(user);
}
