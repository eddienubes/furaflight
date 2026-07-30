/**
 * Compiles the platform-specific `furaflight` binary for every target in
 * `scripts/platforms.ts` (or a filtered subset — see below), using Bun's
 * cross-compilation support (`bun build --compile --target=bun-<...>`).
 * This can all run from a single host/OS (no runner matrix needed).
 *
 * Usage:
 *   bun run scripts/build-platforms.ts                  # build all 8 targets
 *   bun run scripts/build-platforms.ts darwin-arm64      # build just this one
 *   bun run scripts/build-platforms.ts linux-x64 linux-x64-musl
 *
 * Assumes `scripts/generate-platform-packages.ts` has already been run (or
 * runs it here isn't required — this script creates the `bin/` directory
 * itself, so it works standalone too).
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { PLATFORM_TARGETS } from "./platforms.ts";

const REPO_ROOT = join(import.meta.dir, "..");
const PLATFORMS_DIR = join(REPO_ROOT, "platforms");
const ENTRYPOINT = join(REPO_ROOT, "src/main.ts");

const BASE_BUILD_FLAGS = ["--compile", "--bytecode", "--minify", "--format", "esm", "--sourcemap"];

async function buildTarget(target: (typeof PLATFORM_TARGETS)[number]): Promise<void> {
  const outDir = join(PLATFORMS_DIR, target.packageSuffix, "bin");
  mkdirSync(outDir, { recursive: true });
  const outfile = join(outDir, target.binaryName);

  const args = [
    "build",
    ...BASE_BUILD_FLAGS,
    `--target=${target.bunTarget}`,
    "--outfile",
    outfile,
    ENTRYPOINT,
  ];

  console.log(`\n[build-platforms] ${target.packageSuffix} (${target.bunTarget}) -> ${outfile}`);
  const proc = Bun.spawn(["bun", ...args], {
    cwd: REPO_ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`bun build failed for target ${target.packageSuffix} (exit code ${exitCode})`);
  }
}

async function main(): Promise<void> {
  const requestedSuffixes = process.argv.slice(2);
  const targets =
    requestedSuffixes.length === 0
      ? PLATFORM_TARGETS
      : PLATFORM_TARGETS.filter((t) => requestedSuffixes.includes(t.packageSuffix));

  if (requestedSuffixes.length > 0 && targets.length !== requestedSuffixes.length) {
    const known = new Set(PLATFORM_TARGETS.map((t) => t.packageSuffix));
    const unknown = requestedSuffixes.filter((s) => !known.has(s));
    console.error(`[build-platforms] unknown target(s): ${unknown.join(", ")}`);
    console.error(`[build-platforms] known targets: ${[...known].join(", ")}`);
    process.exit(1);
  }

  for (const target of targets) {
    await buildTarget(target);
  }

  console.log(`\n[build-platforms] built ${targets.length} target(s) successfully.`);
}

await main();
