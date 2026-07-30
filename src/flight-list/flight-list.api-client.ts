import { FlightlistApiError, FlightlistTimeoutError } from "./flight-list.errors.ts";

const SEARCH_URL = "https://www.flightlist.io/api/search.php";
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Full typing of flightlist.io's `search.php` response shape. This mirrors the
 * upstream JSON exactly (a thin wrapper around Kiwi's old Tequila API) so the
 * normalizer has a complete, accurate source type to trim from.
 */

export interface FlightlistCountry {
  code: string;
  name: string;
}

export interface FlightlistDuration {
  departure: number;
  return: number;
  total: number;
}

export interface FlightlistFare {
  adults: number;
  children: number;
  infants: number;
}

export interface FlightlistBaglimit {
  hold_dimensions_sum: number;
  hold_height: number;
  hold_length: number;
  hold_weight: number;
  hold_width: number;
  personal_item_dimensions_sum: number;
  personal_item_height: number;
  personal_item_length: number;
  personal_item_weight: number;
  personal_item_width: number;
}

export interface FlightlistAvailability {
  seats: number | null;
}

export interface FlightlistRouteLeg {
  id: string;
  combination_id: string;
  flyFrom: string;
  flyTo: string;
  cityFrom: string;
  cityCodeFrom: string;
  cityTo: string;
  cityCodeTo: string;
  local_departure: string;
  utc_departure: string;
  local_arrival: string;
  utc_arrival: string;
  airline: string;
  flight_no: number;
  operating_carrier: string;
  operating_flight_no: string;
  fare_basis: string;
  fare_category: string;
  fare_classes: string;
  return: number;
  bags_recheck_required: boolean;
  vi_connection: boolean;
  guarantee: boolean;
  equipment: string | null;
  vehicle_type: string;
}

export interface FlightlistFlight {
  id: string;
  flyFrom: string;
  flyTo: string;
  cityFrom: string;
  cityCodeFrom: string;
  cityTo: string;
  cityCodeTo: string;
  countryFrom: FlightlistCountry;
  countryTo: FlightlistCountry;
  local_departure: string;
  utc_departure: string;
  local_arrival: string;
  utc_arrival: string;
  nightsInDest: number | null;
  quality: number;
  distance: number;
  duration: FlightlistDuration;
  price: number;
  conversion: Record<string, number>;
  fare: FlightlistFare;
  bags_price: Record<string, number>;
  bags_conversion: Record<string, Record<string, number>>;
  baglimit: FlightlistBaglimit;
  availability: FlightlistAvailability;
  airlines: string[];
  route: FlightlistRouteLeg[];
  booking_token: string;
  deep_link: string;
  facilitated_booking_available: boolean;
  pnr_count: number;
  has_airport_change: boolean;
  technical_stops: number;
  throw_away_ticketing: boolean;
  hidden_city_ticketing: boolean;
  virtual_interlining: boolean;
}

export interface FlightlistSearchResponse {
  search_id: string;
  currency: string;
  fx_rate: number;
  data: FlightlistFlight[];
}

/** Raw upstream query params for `GET /api/search.php`, as extracted from skypicker.js. */
export interface FlightlistSearchRequestParams {
  fly_from: string;
  fly_to: string;
  date_from: string;
  date_to: string;
  adults: number;
  children: number;
  infants: number;
  selected_cabins: "M" | "W" | "C" | "F";
  curr: string;
  limit: number;
  sort: "price";
  max_stopovers?: number;
  stopover_from: string;
  stopover_to: string;
  ret_from_diff_city: boolean;
  ret_to_diff_city: boolean;
  dtime_from: string;
  dtime_to: string;
  enable_vi: boolean;
  flight_type: "oneway" | "return";
  adult_hand_bag: number;
  adult_hold_bag: number;
  // Upstream rejects these unless the request also has children > 0.
  child_hand_bag?: number;
  child_hold_bag?: number;
  return_from?: string;
  return_to?: string;
  nights_in_dst_from?: number;
  nights_in_dst_to?: number;
}

export class FlightlistApiClient {
  private readonly timeoutMs: number;
  private readonly baseUrl: string;

  constructor(timeoutMs: number = DEFAULT_TIMEOUT_MS, baseUrl: string = SEARCH_URL) {
    this.timeoutMs = timeoutMs;
    this.baseUrl = baseUrl;
  }

  async search(params: FlightlistSearchRequestParams): Promise<FlightlistSearchResponse> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      query.set(key, String(value));
    }

    const url = `${this.baseUrl}?${query.toString()}`;

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        throw new FlightlistTimeoutError(`Request to ${url} timed out after ${this.timeoutMs}ms.`);
      }
      throw error;
    }

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
