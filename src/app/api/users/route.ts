import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET — list all users
export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(users);
}
