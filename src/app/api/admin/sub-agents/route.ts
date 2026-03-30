import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const agents = await prisma.subAgentDef.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(agents);
}

export async function POST(req: Request) {
  const body = await req.json();

  if (!body.name) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }

  const agent = await prisma.subAgentDef.create({
    data: {
      name: body.name,
      description: body.description ?? "",
      systemPrompt: body.systemPrompt ?? "",
      outputFormat: body.outputFormat ?? "",
    },
  });

  return NextResponse.json(agent, { status: 201 });
}
