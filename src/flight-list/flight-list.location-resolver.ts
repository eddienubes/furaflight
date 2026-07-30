import { join } from "node:path";
import appDirs from "appdirsjs";
import {
  FlightlistApiError,
  FlightlistTimeoutError,
  LocationResolutionError,
} from "./flight-list.errors.ts";
import { extractJsonArray } from "./flight-list.utils.ts";

const useAppDirs = (appDirs as any).default as typeof appDirs;

/**
 * Minimal typing for flightlist.io's static `locations.js` / `airlines.js`
 * datasets — only the fields LocationResolver actually reads. Airports,
 * cities and countries expose a `code`; regions only expose `id` (which, for
 * a region, is itself the comma-separated list of ISO country codes to send
 * upstream).
 */
export interface LocationEntry {
  type: "airport" | "city" | "country" | "region";
  id: string;
  code?: string;
  name: string;
  active?: boolean;
  slug?: string;
  slug_en?: string;
  alternative_names?: string[];
}

export interface AirlineEntry {
  id: string;
  name: string;
}

const LOCATIONS_URL = "https://www.flightlist.io/data/v2/locations.js";
const AIRLINES_URL = "https://www.flightlist.io/data/v2/airlines.js";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_CANDIDATES = 8;

interface CacheFile<T> {
  fetchedAt: number;
  data: T[];
}

const defaultCacheDir = (): string => useAppDirs({ appName: "flightlist-mcp" }).cache;

/**
 * Resolves free-text place names or IATA/ISO codes to the codes flightlist.io's
 * search API expects, backed by the airport/city/country/region dataset and
 * the airline code -> name map, both fetched at runtime and disk-cached.
 */
export class LocationResolver {
  private readonly locations: LocationEntry[];
  private readonly airlines: Map<string, string>;

  protected constructor(locations: LocationEntry[], airlines: Map<string, string>) {
    this.locations = locations;
    this.airlines = airlines;
  }

  static async create(cacheDir: string = defaultCacheDir()): Promise<LocationResolver> {
    const [locations, airlineEntries] = await Promise.all([
      LocationResolver.loadDataset<LocationEntry>(
        join(cacheDir, "locations.json"),
        LOCATIONS_URL,
        extractJsonArray as (text: string) => LocationEntry[],
      ),
      LocationResolver.loadDataset<AirlineEntry>(
        join(cacheDir, "airlines.json"),
        AIRLINES_URL,
        extractJsonArray as (text: string) => AirlineEntry[],
      ),
    ]);
    const airlines = new Map(airlineEntries.map((airline) => [airline.id, airline.name]));
    return new LocationResolver(locations, airlines);
  }

  resolve(field: string): string {
    const tokens = field
      .split(",")
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
    if (tokens.length === 0) throw new LocationResolutionError(field, []);
    return tokens.map((token) => this.resolveToken(token)).join(",");
  }

  airlineNames(): ReadonlyMap<string, string> {
    return this.airlines;
  }

  private static async loadDataset<T>(
    cacheFile: string,
    url: string,
    parse: (text: string) => T[],
  ): Promise<T[]> {
    const cached = await LocationResolver.readCache<T>(cacheFile);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      let response: Response;
      try {
        response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      } catch (error) {
        if (
          error instanceof Error &&
          (error.name === "TimeoutError" || error.name === "AbortError")
        ) {
          throw new FlightlistTimeoutError(
            `Request to ${url} timed out after ${FETCH_TIMEOUT_MS}ms.`,
          );
        }
        throw error;
      }
      if (!response.ok)
        throw new FlightlistApiError(`Failed to fetch ${url}: HTTP ${response.status}.`);
      const data = parse(await response.text());
      await Bun.write(
        cacheFile,
        JSON.stringify({ fetchedAt: Date.now(), data } satisfies CacheFile<T>),
      );
      return data;
    } catch {
      if (cached) return cached.data;
      throw new FlightlistApiError(`Failed to fetch ${url} and no cached copy is available.`);
    }
  }

  private static async readCache<T>(file: string): Promise<CacheFile<T> | undefined> {
    try {
      const bunFile = Bun.file(file);
      if (!(await bunFile.exists())) return undefined;
      return (await bunFile.json()) as CacheFile<T>;
    } catch {
      return undefined;
    }
  }

  /**
   * Resolves a single token by trying, in order: exact code match, exact name
   * match, then a fuzzy substring match against name/slug/alternative-name
   * fields — each tier deduped by resolved value and only accepted if it
   * narrows to exactly one candidate.
   */
  private resolveToken(token: string): string {
    const entries = this.locations;
    const normalized = token.toLowerCase();

    const exactCode = this.matchAndDedupe(
      entries,
      (entry) => entry.active !== false && entry.code?.toLowerCase() === normalized,
    );
    if (exactCode.length === 1) return this.resolvedValueOf(exactCode[0]!);
    if (exactCode.length > 1) throw this.ambiguous(token, exactCode);

    const nameMatches = (entry: LocationEntry): string[] =>
      [entry.name, entry.slug, entry.slug_en, ...(entry.alternative_names ?? [])].filter(
        (value): value is string => value !== undefined,
      );

    const exactName = this.matchAndDedupe(
      entries,
      (entry) =>
        entry.active !== false &&
        nameMatches(entry).some((value) => value.toLowerCase() === normalized),
    );
    if (exactName.length === 1) return this.resolvedValueOf(exactName[0]!);
    if (exactName.length > 1) throw this.ambiguous(token, exactName);

    const fuzzy = this.matchAndDedupe(
      entries,
      (entry) =>
        entry.active !== false &&
        nameMatches(entry).some((value) => value.toLowerCase().includes(normalized)),
    );
    if (fuzzy.length === 1) return this.resolvedValueOf(fuzzy[0]!);
    if (fuzzy.length === 0) throw new LocationResolutionError(token, []);
    throw this.ambiguous(token, fuzzy);
  }

  private matchAndDedupe(
    entries: LocationEntry[],
    predicate: (entry: LocationEntry) => boolean,
  ): LocationEntry[] {
    const seen = new Map<string, LocationEntry>();
    for (const entry of entries) {
      if (!predicate(entry)) continue;
      const value = this.resolvedValueOf(entry);
      if (!seen.has(value)) seen.set(value, entry);
    }
    return [...seen.values()];
  }

  private resolvedValueOf(entry: LocationEntry): string {
    return entry.type === "region" ? entry.id : (entry.code ?? entry.id);
  }

  private ambiguous(token: string, candidates: LocationEntry[]): LocationResolutionError {
    const labels = candidates
      .slice(0, MAX_CANDIDATES)
      .map((entry) => `${entry.name} (${this.resolvedValueOf(entry)})`);
    return new LocationResolutionError(token, labels);
  }
}
