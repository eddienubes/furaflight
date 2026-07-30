import { homedir } from "node:os";
import { join } from "node:path";
import { FlightlistApiError, LocationResolutionError } from "./errors.ts";
import { fetchWithTimeout } from "./fetchWithTimeout.ts";
import type { AirlineEntry, LocationEntry } from "./types/location.ts";

const LOCATIONS_URL = "https://www.flightlist.io/data/v2/locations.js";
const AIRLINES_URL = "https://www.flightlist.io/data/v2/airlines.js";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_CANDIDATES = 8;

interface CacheFile<T> {
  fetchedAt: number;
  data: T[];
}

function defaultCacheDir(): string {
  const home = homedir();
  if (process.platform === "darwin") return join(home, "Library", "Caches", "flightlist-mcp");
  if (process.platform === "win32") {
    return join(process.env.LOCALAPPDATA ?? join(home, "AppData", "Local"), "flightlist-mcp", "Cache");
  }
  return join(process.env.XDG_CACHE_HOME ?? join(home, ".cache"), "flightlist-mcp");
}

function extractJsonArray(text: string): unknown[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new FlightlistApiError("Unexpected dataset format from flightlist.io.");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function resolvedValueOf(entry: LocationEntry): string {
  return entry.type === "region" ? entry.id : (entry.code ?? entry.id);
}

function candidateLabel(entry: LocationEntry): string {
  return `${entry.name} (${resolvedValueOf(entry)})`;
}

function matchesFuzzy(entry: LocationEntry, normalizedToken: string): boolean {
  if (entry.name.toLowerCase().includes(normalizedToken)) return true;
  if (entry.slug?.toLowerCase().includes(normalizedToken)) return true;
  if (entry.slug_en?.toLowerCase().includes(normalizedToken)) return true;
  return entry.alternative_names?.some((alt) => alt.toLowerCase().includes(normalizedToken)) ?? false;
}

function dedupeByValue(entries: LocationEntry[]): LocationEntry[] {
  const seen = new Map<string, LocationEntry>();
  for (const entry of entries) {
    const value = resolvedValueOf(entry);
    if (!seen.has(value)) seen.set(value, entry);
  }
  return [...seen.values()];
}

async function readCache<T>(file: string): Promise<CacheFile<T> | undefined> {
  try {
    const bunFile = Bun.file(file);
    if (!(await bunFile.exists())) return undefined;
    return (await bunFile.json()) as CacheFile<T>;
  } catch {
    return undefined;
  }
}

async function loadDataset<T>(cacheFile: string, url: string, parse: (text: string) => T[]): Promise<T[]> {
  const cached = await readCache<T>(cacheFile);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!response.ok) throw new FlightlistApiError(`Failed to fetch ${url}: HTTP ${response.status}.`);
    const data = parse(await response.text());
    await Bun.write(cacheFile, JSON.stringify({ fetchedAt: Date.now(), data } satisfies CacheFile<T>));
    return data;
  } catch {
    if (cached) return cached.data;
    throw new FlightlistApiError(`Failed to fetch ${url} and no cached copy is available.`);
  }
}

/**
 * Resolves free-text place names or IATA/ISO codes to the codes flightlist.io's
 * search API expects, backed by the airport/city/country/region dataset and
 * the airline code -> name map, both fetched at runtime and disk-cached.
 */
export class LocationResolver {
  private locations: LocationEntry[] | undefined;
  private airlines: Map<string, string> | undefined;

  constructor(private readonly cacheDir: string = defaultCacheDir()) {}

  private async ensureLoaded(): Promise<void> {
    if (this.locations && this.airlines) return;
    const [locations, airlineEntries] = await Promise.all([
      loadDataset<LocationEntry>(join(this.cacheDir, "locations.json"), LOCATIONS_URL, extractJsonArray as (text: string) => LocationEntry[]),
      loadDataset<AirlineEntry>(join(this.cacheDir, "airlines.json"), AIRLINES_URL, extractJsonArray as (text: string) => AirlineEntry[]),
    ]);
    this.locations = locations;
    this.airlines = new Map(airlineEntries.map((airline) => [airline.id, airline.name]));
  }

  /** Resolves a (possibly comma-separated) `from`/`to` field into upstream-ready codes. */
  async resolve(field: string): Promise<string> {
    await this.ensureLoaded();
    const tokens = field
      .split(",")
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
    if (tokens.length === 0) throw new LocationResolutionError(field, []);
    return tokens.map((token) => this.resolveToken(token)).join(",");
  }

  private resolveToken(token: string): string {
    const entries = this.locations ?? [];
    const normalized = token.toLowerCase();

    const exact = dedupeByValue(entries.filter((e) => e.active !== false && e.code?.toLowerCase() === normalized));
    if (exact.length === 1) return resolvedValueOf(exact[0]!);
    if (exact.length > 1) throw new LocationResolutionError(token, exact.slice(0, MAX_CANDIDATES).map(candidateLabel));

    const fuzzy = dedupeByValue(entries.filter((e) => e.active !== false && matchesFuzzy(e, normalized)));
    if (fuzzy.length === 1) return resolvedValueOf(fuzzy[0]!);
    if (fuzzy.length === 0) throw new LocationResolutionError(token, []);
    throw new LocationResolutionError(token, fuzzy.slice(0, MAX_CANDIDATES).map(candidateLabel));
  }

  async airlineNames(): Promise<ReadonlyMap<string, string>> {
    await this.ensureLoaded();
    return this.airlines ?? new Map();
  }
}
