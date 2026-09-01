import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

/**
 * Sets up a fresh, migrated, throwaway SQLite database for one test
 * file and points DATABASE_URL at it. Uses `migrate deploy` (applies
 * existing migration files) rather than `db push --accept-data-loss`
 * — the latter is flagged as a destructive action and Prisma's CLI
 * refuses to run it for AI agents without explicit user consent, even
 * against a brand-new throwaway file, since it can't tell that from a
 * production target.
 *
 * Call from a per-file `beforeAll` *before* importing the action
 * module under test — action modules import `@/lib/prisma`, whose
 * module-level PrismaClient reads DATABASE_URL at import time, so a
 * static top-level `import` of an action module would bind to
 * whatever DATABASE_URL existed before this ran. Use a dynamic
 * `await import("./whatever")` inside beforeAll instead. Vitest gives
 * each test file its own module registry by default, which is what
 * makes this safe.
 *
 * Callers also need `vi.mock("next/cache", () => ({ revalidatePath:
 * vi.fn(), revalidateTag: vi.fn() }))` — revalidatePath throws outside
 * a real Next.js request context, which every action under test calls.
 */
export async function setupTestDb(): Promise<{ cleanup: () => Promise<void> }> {
  const dbPath = path.join(
    os.tmpdir(),
    `nmt-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
  );
  process.env.DATABASE_URL = `file:${dbPath}`;

  execSync("npx prisma migrate deploy --config prisma7.config.ts", {
    cwd: process.cwd(),
    env: { ...process.env },
    stdio: "pipe",
  });

  return {
    cleanup: async () => {
      // better-sqlite3 holds the file open until disconnected — on
      // Windows, unlinking before that silently fails and leaks the file.
      const { prisma } = await import("@/lib/prisma");
      await prisma.$disconnect();
      for (const suffix of ["", "-journal", "-wal", "-shm"]) {
        try {
          fs.unlinkSync(dbPath + suffix);
        } catch {
          // already gone
        }
      }
    },
  };
}
