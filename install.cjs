#!/usr/bin/env node
"use strict";

/**
 * postinstall script for @furaflight/mcp.
 *
 * Modeled on how @anthropic-ai/claude-code ships its own compiled binary:
 * the real, platform-specific binary is published as one of 8 separate
 * `@furaflight/mcp-<platform>` packages, listed as `optionalDependencies`
 * of this package so npm/pnpm/yarn/bun only ever download the one matching
 * the install machine (via that package's own `os`/`cpu`/`libc` fields).
 * This script does NOT download anything — the matching package is already
 * on disk by the time this postinstall runs, as a normal part of npm's own
 * dependency resolution. All this script does is find that already-
 * installed binary and place it at the fixed path this package's own
 * `bin` field points at (`bin/furaflight.exe` — the `.exe` suffix is used
 * on every platform, not just Windows, because npm's Windows cmd-shim
 * generator requires the target to literally be a `.exe`; POSIX ignores
 * the extension so it's harmless elsewhere).
 *
 * Plain Node.js CommonJS on purpose (no Bun-only syntax, no dependencies
 * of its own) — Node is what's guaranteed present, since npm/npx/pnpm/yarn
 * themselves all run on Node regardless of whether the end user separately
 * has Bun installed.
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Keep this table's keys/packages in lockstep with scripts/platforms.ts by
// hand (this file ships standalone in the published tarball, so it can't
// import that module at runtime) — a parity test in install.spec.ts fails
// CI if the two ever drift apart.
const PLATFORM_PACKAGES = {
  "darwin-x64": { pkg: "@furaflight/mcp-darwin-x64", bin: "furaflight" },
  "darwin-arm64": { pkg: "@furaflight/mcp-darwin-arm64", bin: "furaflight" },
  "linux-x64-glibc": { pkg: "@furaflight/mcp-linux-x64", bin: "furaflight" },
  "linux-x64-musl": { pkg: "@furaflight/mcp-linux-x64-musl", bin: "furaflight" },
  "linux-arm64-glibc": { pkg: "@furaflight/mcp-linux-arm64", bin: "furaflight" },
  "linux-arm64-musl": { pkg: "@furaflight/mcp-linux-arm64-musl", bin: "furaflight" },
  "win32-x64": { pkg: "@furaflight/mcp-win32-x64", bin: "furaflight.exe" },
  "win32-arm64": { pkg: "@furaflight/mcp-win32-arm64", bin: "furaflight.exe" },
};

const DEST_BINARY_NAME = "furaflight.exe";

/**
 * Detects musl vs glibc on Linux via `process.report.getReport()` instead
 * of spawning `ldd` (which can fail or simply be missing in minimal
 * containers). A glibc runtime report includes `header.glibcVersionRuntime`;
 * its absence on Linux is treated as musl.
 */
function isMusl() {
  if (typeof process.report?.getReport !== "function") {
    // No process.report support (very old Node) — assume glibc, the more
    // common case, rather than fail outright.
    return false;
  }
  try {
    const report = process.report.getReport();
    return !report?.header?.glibcVersionRuntime;
  } catch {
    return false;
  }
}

/** Computes the lookup key into PLATFORM_PACKAGES for the current machine. */
function detectPlatformKey() {
  const platform = process.platform;
  const arch = os.arch();
  if (platform === "linux") {
    return `linux-${arch}-${isMusl() ? "musl" : "glibc"}`;
  }
  return `${platform}-${arch}`;
}

function getDestPath() {
  return path.join(__dirname, "bin", DEST_BINARY_NAME);
}

/**
 * Detects whether this script is running against a checkout of the source
 * repo itself (e.g. a contributor's `bun install`, or this repo's own CI
 * job installing dev dependencies before it builds/publishes anything)
 * rather than an actual end-user install of the published tarball. The
 * published tarball's `files` list is just `install.cjs`, `README.md`, and
 * `LICENSE` — it never contains `src/` — so this can't false-positive for
 * a real consumer install; it only ever fires for this package's own repo.
 * Necessary because this same package.json is both the published package
 * *and* the source repo, and the source repo has no compiled binary
 * (platform packages) to resolve at `bun install` time — that's expected,
 * not an error.
 */
function isRunningInsideSourceRepo() {
  return fs.existsSync(path.join(__dirname, "src", "main.ts"));
}

/**
 * Places `srcPath` at `destPath`: hardlink first (fast, zero extra disk
 * use), falling back to unlink-then-hardlink, falling back further to a
 * plain copy (handles cross-device links or restrictive permissions).
 */
function placeBinary(srcPath, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  try {
    fs.linkSync(srcPath, destPath);
  } catch {
    try {
      fs.unlinkSync(destPath);
    } catch {
      // destPath may not exist yet — fine, keep going.
    }
    try {
      fs.linkSync(srcPath, destPath);
    } catch {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  if (process.platform !== "win32") {
    fs.chmodSync(destPath, 0o755);
  }
}

function printUnsupportedPlatformError(platformKey) {
  const supported = Object.keys(PLATFORM_PACKAGES).sort().join(", ");
  console.error(
    [
      `furaflight: unsupported platform "${platformKey}" (process.platform=${process.platform}, os.arch()=${os.arch()}).`,
      `Supported platforms: ${supported}.`,
      "If you believe this is wrong, please open an issue at https://github.com/eddienubes/furaflight/issues.",
    ].join("\n"),
  );
}

function printMissingPackageError(platformKey, entry) {
  console.error(
    [
      `furaflight: could not find the "${entry.pkg}" package on disk (expected for platform "${platformKey}").`,
      "This usually means it was skipped during install — try reinstalling without",
      '"--ignore-scripts" and without "--no-optional" (or your package manager\'s',
      "equivalent flags), so npm can download the platform-specific binary package.",
    ].join("\n"),
  );
}

function main() {
  if (isRunningInsideSourceRepo()) {
    console.log("furaflight: running inside the source repo, skipping binary placement.");
    return;
  }

  const platformKey = detectPlatformKey();
  const entry = PLATFORM_PACKAGES[platformKey];

  if (!entry) {
    printUnsupportedPlatformError(platformKey);
    process.exit(1);
    return;
  }

  let resolvedBinaryPath;
  try {
    resolvedBinaryPath = require.resolve(`${entry.pkg}/bin/${entry.bin}`);
  } catch {
    printMissingPackageError(platformKey, entry);
    process.exit(1);
    return;
  }

  const destPath = getDestPath();
  try {
    placeBinary(resolvedBinaryPath, destPath);
  } catch (err) {
    console.error(`furaflight: failed to place binary at ${destPath}: ${err.message}`);
    process.exit(1);
    return;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  PLATFORM_PACKAGES,
  DEST_BINARY_NAME,
  isMusl,
  detectPlatformKey,
  getDestPath,
  isRunningInsideSourceRepo,
};
