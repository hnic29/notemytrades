import { execSync } from "node:child_process";
import path from "node:path";

/**
 * Every app page now redirects to /onboarding until AppSettings.onboardedAt
 * is set (see (app)/layout.tsx) — a real, freshly-migrated database starts
 * un-onboarded, which would otherwise make every existing e2e spec redirect
 * away before it gets to the page it's testing. Bootstrap the same
 * "already set up" state a real returning user would have, once, before
 * the suite runs.
 *
 * Shells out to tsx rather than importing src/lib/prisma directly:
 * Playwright loads globalSetup through its own CJS-oriented loader, and
 * the generated Prisma client uses import.meta (ESM-only), which throws
 * under that loader. Running it as a separate tsx process (the same way
 * every ad-hoc script in this repo has been run) sidesteps the conflict.
 */
export default async function globalSetup() {
  execSync("npx tsx e2e/bootstrap-onboarded.ts", {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
  });
}
