/**
 * CI publish orchestration: publishes all 8 platform packages first, then
 * the main `@furaflight/mcp` package — so that by the time the main package
 * exists on the registry, every version its `optionalDependencies` point at
 * already exists too (avoids a race for anyone installing in between).
 *
 * Assumes `scripts/generate-platform-packages.ts` and
 * `scripts/build-platforms.ts` have already populated `platforms/<suffix>/`
 * with a package.json + compiled binary for each target, and that npm
 * registry auth is already configured (e.g. via .npmrc), same as the
 * existing single-package workflow.
 *
 * Pass --dry-run to forward `--dry-run` to every `bun publish` invocation
 * (see `bun publish --help`) instead of actually publishing — this is the
 * only mode this script should ever be invoked with outside of real CI.
 */

import { join } from "node:path";
import { PLATFORM_TARGETS } from "./platforms.ts";

const REPO_ROOT = join(import.meta.dir, "..");
const PLATFORMS_DIR = join(REPO_ROOT, "platforms");

async function publish(cwd: string, label: string, dryRun: boolean): Promise<void> {
  const args = ["publish", "--access", "public", ...(dryRun ? ["--dry-run"] : [])];
  console.log(`\n[publish-platforms] publishing ${label}${dryRun ? " (dry run)" : ""}...`);
  const proc = Bun.spawn(["bun", ...args], {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`bun publish failed for ${label} (exit code ${exitCode})`);
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  for (const target of PLATFORM_TARGETS) {
    await publish(join(PLATFORMS_DIR, target.packageSuffix), target.packageName, dryRun);
  }

  await publish(REPO_ROOT, "@furaflight/mcp", dryRun);

  console.log("\n[publish-platforms] done.");
}

await main();
