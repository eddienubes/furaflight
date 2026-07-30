/**
 * Generates the 8 minimal `platforms/<suffix>/package.json` manifests from
 * `scripts/platforms.ts`, always pinning their version to the main
 * package's current `version`. Run this before `build-platforms.ts` and
 * before publishing the platform packages.
 *
 * The `platforms/` directory is generated, not committed (see
 * .gitignore) — it's recreated fresh from source of truth every time this
 * script runs, so there's nothing to keep manually in sync.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import rootPkg from "../package.json" with { type: "json" };
import { PLATFORM_TARGETS } from "./platforms.ts";

const REPO_ROOT = join(import.meta.dir, "..");
const PLATFORMS_DIR = join(REPO_ROOT, "platforms");

function main(): void {
  for (const target of PLATFORM_TARGETS) {
    const dir = join(PLATFORMS_DIR, target.packageSuffix);
    mkdirSync(join(dir, "bin"), { recursive: true });

    const manifest = {
      name: target.packageName,
      version: rootPkg.version,
      description: `Precompiled furaflight MCP server binary for ${target.os}/${target.cpu}${
        target.libc ? ` (${target.libc})` : ""
      }.`,
      license: rootPkg.license,
      os: [target.os],
      cpu: [target.cpu],
      ...(target.libc ? { libc: [target.libc] } : {}),
      files: ["bin"],
    };

    writeFileSync(join(dir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`generated platforms/${target.packageSuffix}/package.json (v${rootPkg.version})`);
  }
}

main();
