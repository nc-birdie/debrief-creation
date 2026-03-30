import path from "node:path";
import { defineConfig } from "prisma/config";

const dbPath = path.join(__dirname, "prisma", "dev.db");

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  migrate: {
    adapter: async () => {
      const { default: Database } = await import("better-sqlite3");
      const { PrismaBetterSQLite3 } = await import("@prisma/adapter-better-sqlite3");
      const database = new Database(dbPath);
      return new PrismaBetterSQLite3(database);
    },
  },
  datasource: {
    url: `file:${dbPath}`,
  },
});
