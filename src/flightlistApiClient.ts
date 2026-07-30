import { FlightlistApiError } from "./errors.ts";
import { fetchWithTimeout } from "./fetchWithTimeout.ts";
import type {
  FlightlistSearchRequestParams,
  FlightlistSearchResponse,
} from "./types/flightlist.ts";

const SEARCH_URL = "https://www.flightlist.io/api/search.php";
const DEFAULT_TIMEOUT_MS = 15_000;

export class FlightlistApiClient {
  private readonly timeoutMs: number;

  constructor(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
  }

  async search(params: FlightlistSearchRequestParams): Promise<FlightlistSearchResponse> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      query.set(key, String(value));
    }

    const url = `${SEARCH_URL}?${query.toString()}`;
    const response = await fetchWithTimeout(url, this.timeoutMs);

    if (!response.ok) {
      throw new FlightlistApiError(`flightlist.io search returned HTTP ${response.status}.`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new FlightlistApiError("flightlist.io search returned malformed JSON.");
    }

    return body as FlightlistSearchResponse;
  }
}
