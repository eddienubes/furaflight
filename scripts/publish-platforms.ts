/**
 * CI publish orchestration: publishes all 8 platform packages first, then
 * the main package, so its `optionalDependencies` always
 * resolve once it lands on the registry.
 *
 * Pass --dry-run to forward `--dry-run` to every `bun publish` invocation —
 * the only mode this script should ever be invoked with outside of real CI.
 */

import path from "node:path";
import {
  PACKAGE_BASE_NAME,
  PACKAGE_SCOPE,
  PLATFORM_TARGETS,
  PLATFORMS_DIR,
  REPO_ROOT,
} from "./constants.ts";

const publish = async (cwd: string, label: string, dryRun: boolean): Promise<void> => {
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
};

const main = async (): Promise<void> => {
  const dryRun = process.argv.includes("--dry-run");

  for (const target of PLATFORM_TARGETS) {
    await publish(path.join(PLATFORMS_DIR, target.packageSuffix), target.packageName, dryRun);
  }

  await publish(REPO_ROOT, `${PACKAGE_SCOPE}/${PACKAGE_BASE_NAME}`, dryRun);

  console.log("\n[publish-platforms] done.");
};

await main();
