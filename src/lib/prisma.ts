import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

// Relative sqlite paths are resolved against the project root (where
// prisma7.config.ts lives), matching how `prisma migrate` resolves them.
const dbPath =
  process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./data/notemytrades.db";

const adapter = new PrismaBetterSqlite3({
  url: path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath),
});

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
