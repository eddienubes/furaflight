/**
 * Single source of truth for the 8 platform-specific binaries we publish
 * under `@furaflight/mcp-<platform>` via npm optionalDependencies, modeled
 * on how `@anthropic-ai/claude-code` ships its own compiled binary.
 *
 * Every other script that needs to know the platform matrix (package
 * generation, multi-target build, publish orchestration, and the
 * install.cjs parity test) imports this file instead of re-declaring the
 * list, so the 8 entries only ever live in one place.
 */

export interface PlatformTarget {
  /** Suffix used both for the npm package name and the platforms/<suffix> directory, e.g. "darwin-x64". */
  packageSuffix: string;
  /** Full npm package name, e.g. "@furaflight/mcp-darwin-x64". */
  packageName: string;
  /** Value passed to `bun build --compile --target=<bunTarget>`. */
  bunTarget: string;
  /** Matches Node's `process.platform`. */
  os: "darwin" | "linux" | "win32";
  /** Matches Node's `os.arch()`. */
  cpu: "x64" | "arm64";
  /** Only set for Linux targets; matches Node's libc detection. */
  libc?: "glibc" | "musl";
  /** Filename of the compiled binary inside the platform package's bin/ dir. */
  binaryName: string;
}

const PACKAGE_SCOPE = "@furaflight";
const PACKAGE_BASE_NAME = "mcp";

function definePlatform(
  packageSuffix: string,
  bunTarget: string,
  os: PlatformTarget["os"],
  cpu: PlatformTarget["cpu"],
  libc: PlatformTarget["libc"] | undefined,
  binaryName: string,
): PlatformTarget {
  return {
    packageSuffix,
    packageName: `${PACKAGE_SCOPE}/${PACKAGE_BASE_NAME}-${packageSuffix}`,
    bunTarget,
    os,
    cpu,
    libc,
    binaryName,
  };
}

export const PLATFORM_TARGETS: readonly PlatformTarget[] = [
  definePlatform("darwin-x64", "bun-darwin-x64", "darwin", "x64", undefined, "furaflight"),
  definePlatform("darwin-arm64", "bun-darwin-arm64", "darwin", "arm64", undefined, "furaflight"),
  definePlatform("linux-x64", "bun-linux-x64", "linux", "x64", "glibc", "furaflight"),
  definePlatform("linux-x64-musl", "bun-linux-x64-musl", "linux", "x64", "musl", "furaflight"),
  definePlatform("linux-arm64", "bun-linux-arm64", "linux", "arm64", "glibc", "furaflight"),
  definePlatform(
    "linux-arm64-musl",
    "bun-linux-arm64-musl",
    "linux",
    "arm64",
    "musl",
    "furaflight",
  ),
  definePlatform("win32-x64", "bun-windows-x64", "win32", "x64", undefined, "furaflight.exe"),
  definePlatform("win32-arm64", "bun-windows-arm64", "win32", "arm64", undefined, "furaflight.exe"),
];

/**
 * The key `install.cjs` uses (independently, in plain CommonJS) to look up
 * the right platform package at postinstall time. Linux entries always
 * carry an explicit glibc/musl suffix to disambiguate; the npm package name
 * itself only adds a "-musl" suffix for the musl variant (see table in the
 * adjustment brief), which is a distinct string on purpose.
 */
export function getPlatformKey(target: PlatformTarget): string {
  return target.libc ? `${target.os}-${target.cpu}-${target.libc}` : `${target.os}-${target.cpu}`;
}
