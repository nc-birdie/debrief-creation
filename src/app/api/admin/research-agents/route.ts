import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { RESEARCH_AGENT_SEEDS } from "@/lib/research-agent-seeds";
import { BRIEFING_FRAMEWORK } from "@/lib/briefing-questions";

/**
 * GET /api/admin/research-agents
 * Returns all research agents with their category info.
 * Auto-seeds from RESEARCH_AGENT_SEEDS if none exist and categories are present.
 */
export async function GET() {
  let agents = await prisma.researchAgentDef.findMany({
    include: {
      category: { select: { id: true, label: true, sortOrder: true, enabled: true } },
    },
    orderBy: { category: { sortOrder: "asc" } },
  });

  // Auto-seed if empty and categories exist
  if (agents.length === 0) {
    // Ensure briefing categories are seeded first
    let categories = await prisma.briefingCategory.findMany();
    if (categories.length === 0) {
      // Seed categories from framework
      for (let i = 0; i < BRIEFING_FRAMEWORK.length; i++) {
        const cat = BRIEFING_FRAMEWORK[i];
        await prisma.briefingCategory.create({
          data: {
            label: cat.label,
            sortOrder: i,
            questions: {
              create: cat.questions.map((q, qi) => ({
                question: q.question,
                sortOrder: qi,
              })),
            },
          },
        });
      }
      categories = await prisma.briefingCategory.findMany();
    }

    // Create research agents for each category
    for (const cat of categories) {
      const seed = RESEARCH_AGENT_SEEDS.find((s) => {
        // Match by label similarity since DB categories may not have the framework key
        const frameworkCat = BRIEFING_FRAMEWORK.find((f) => f.label === cat.label);
        return frameworkCat && s.categoryKey === frameworkCat.id;
      });

      await prisma.researchAgentDef.create({
        data: {
          categoryId: cat.id,
          name: seed?.name ?? `${cat.label} Researcher`,
          instructions: seed?.instructions ?? `Research specialist for: ${cat.label}.\n\nSearch for current, relevant information about this area and provide structured findings.`,
          allowedTools: JSON.stringify(["WebSearch", "WebFetch"]),
          maxTurns: 10,
        },
      });
    }

    agents = await prisma.researchAgentDef.findMany({
      include: {
        category: { select: { id: true, label: true, sortOrder: true, enabled: true } },
      },
      orderBy: { category: { sortOrder: "asc" } },
    });
  }

  // Serialize allowedTools
  const serialized = agents.map((a) => ({
    ...a,
    allowedTools: JSON.parse(a.allowedTools) as string[],
  }));

  return NextResponse.json(serialized);
}
