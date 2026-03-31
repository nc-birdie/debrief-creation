# Direction Setting

AI-powered campaign debrief and direction-setting workshop tool for Birdie Studio.

## Prerequisites

- **Node.js 18+**
- **Claude CLI** installed and logged in (`npm install -g @anthropic-ai/claude-code`, then run `claude` to authenticate)
- Mac users: Xcode command line tools (`xcode-select --install`) for native module compilation

## Quick Start

```bash
git clone https://github.com/nc-birdie/debrief-creation.git
cd debrief-creation
npm install
npm run dev
```

That's it. `npm run dev` automatically creates the SQLite database before starting the server.

The app will be available at **http://localhost:3000** (or the next available port).

## Shared Database (Optional)

By default the database is stored locally at `prisma/dev.db`. To share data across team members, create a `.env` file and point to a shared location:

```bash
DATABASE_PATH=//server/shared/debrief/dev.db
```

See `.env.example` for more options.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (auto-creates DB) |
| `npm run build` | Production build |
| `npm run db:push` | Push schema to database |
| `npm run db:reset` | Reset database |
| `npm run db:studio` | Open Prisma Studio (DB browser) |

## What works without Claude CLI

Everything except AI features: campaign management, admin config, source uploads, manual knowledge editing. The AI-powered ingestion, assessment, research, and step generation require an authenticated Claude CLI session.
