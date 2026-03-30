# CLAUDE.md

## Project Overview

**Direction Setting** — AI-powered campaign debrief and direction-setting workshop tool for Birdie Studio. Guides users through 13 sequential steps from task definition to "Get to, by?" strategic direction statements. AI does the groundwork, surfaces knowledge gaps and decisions for human review.

## Commands

```bash
npm run dev      # Start dev server (port 3000)
npm run build    # Production build + TypeScript checks
npm run db:push  # Push Prisma schema to SQLite
npm run db:reset # Reset database
```

Add shadcn components: `npx shadcn@latest add <component-name>`

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS 4 (PostCSS plugin)
- shadcn/ui (base-nova style, @base-ui/react primitives)
- lucide-react for all icons
- Prisma 7.5 + better-sqlite3 (SQLite)
- Claude Agent SDK for AI generation

## Key Paths

- `src/lib/steps/definitions.ts` — 13 step definitions with dependency graph
- `src/lib/types.ts` — Domain types (Campaign, StepState, KnowledgeGap, Decision)
- `src/lib/db.ts` — Prisma client singleton
- `src/lib/api-client.ts` — Frontend API fetch wrappers
- `src/app/page.tsx` — Dashboard (campaign list + create)
- `src/app/campaign/[campaignId]/page.tsx` — Campaign workspace (3-column: rail + workspace + sidebar)
- `src/app/campaign/[campaignId]/setup/page.tsx` — Source upload + ingestion
- `src/app/admin/page.tsx` — Step config + agent management
- `src/app/api/` — All API routes (campaigns, sources, steps, admin)
- `prisma/schema.prisma` — Database schema

## Architecture

### 13-Step Dependency Graph
Steps build on each other. Each step's `dependsOn` array specifies which prior steps' `finalOutput` gets injected into its AI context. See `definitions.ts`.

### AI Generation Flow
1. User clicks "Generate" → POST `/api/.../generate`
2. Assembles context: source summaries + dependent step outputs + admin instructions
3. Runs Claude Agent SDK `query()` with configured tools
4. Extracts JSON result: `{ draft, knowledgeGaps[], decisions[] }`
5. User reviews, resolves gaps/decisions, edits, then approves

### Admin Module
- Per-step: custom instructions, output format, allowed tools, max turns
- Sub-agents: reusable agent definitions (name, system prompt, output format)

## Patterns

- Import alias: `@/*` maps to `./src/*`
- JSON stored as stringified text in SQLite (knowledgeGaps, decisions, allowedTools)
- Brand: magenta #c72886, Rubik font, dark mode via `.dark` class
