import type {
  FlightlistApiClient,
  FlightlistSearchRequestParams,
} from "./flight-list.api-client.ts";
import { FlightNormalizer, type NormalizedFlight } from "./flight.normalizer.ts";
import type { LocationResolver } from "./location.resolver.ts";
import { toUpstreamDate } from "./utils.ts";

export interface NormalizedSearchParams {
  from: string;
  to: string;
  flightType: "oneway" | "return";
  returnMode?: "dates" | "nights";
  departDateFrom: string;
  departDateTo?: string;
  returnDateFrom?: string;
  returnDateTo?: string;
  minNights?: number;
  maxNights?: number;
  adults: number;
  children: number;
  infants: number;
  cabinClass: "M" | "W" | "C" | "F";
  currency: string;
  maxStops?: number;
  limit: number;
  sort: "price";
}

export interface FlightSearchProvider {
  search(params: NormalizedSearchParams): Promise<NormalizedFlight[]>;
}

export class FlightlistProvider implements FlightSearchProvider {
  private readonly client: FlightlistApiClient;
  private readonly locationResolver: LocationResolver;
  private readonly normalizer: FlightNormalizer;

  constructor(client: FlightlistApiClient, locationResolver: LocationResolver) {
    this.client = client;
    this.locationResolver = locationResolver;
    this.normalizer = new FlightNormalizer();
  }

  async search(params: NormalizedSearchParams): Promise<NormalizedFlight[]> {
    const [flyFrom, flyTo] = await Promise.all([
      this.locationResolver.resolve(params.from),
      this.locationResolver.resolve(params.to),
    ]);

    const response = await this.client.search(this.buildRequestParams(params, flyFrom, flyTo));
    const airlineNames = await this.locationResolver.airlineNames();

    return response.data.map((flight) =>
      this.normalizer.normalize(flight, response.currency, airlineNames),
    );
  }

  /** Builds flightlist.io's raw upstream query params from our normalized search input. */
  private buildRequestParams(
    params: NormalizedSearchParams,
    flyFrom: string,
    flyTo: string,
  ): FlightlistSearchRequestParams {
    const base: FlightlistSearchRequestParams = {
      fly_from: flyFrom,
      fly_to: flyTo,
      date_from: toUpstreamDate(params.departDateFrom),
      date_to: toUpstreamDate(params.departDateTo ?? params.departDateFrom),
      adults: params.adults,
      children: params.children,
      infants: params.infants,
      selected_cabins: params.cabinClass,
      curr: params.currency,
      limit: params.limit,
      sort: params.sort,
      max_stopovers: params.maxStops,
      stopover_from: "00:00",
      stopover_to: "48:00",
      ret_from_diff_city: false,
      ret_to_diff_city: false,
      dtime_from: "00:00",
      dtime_to: "23:59",
      enable_vi: true,
      flight_type: params.flightType,
      adult_hand_bag: 0,
      adult_hold_bag: 0,
      // Upstream rejects child_hand_bag/child_hold_bag unless children > 0.
      ...(params.children > 0 ? { child_hand_bag: 0, child_hold_bag: 0 } : {}),
    };

    if (params.flightType === "oneway") return base;

    if (params.returnMode === "nights") {
      return {
        ...base,
        nights_in_dst_from: params.minNights,
        nights_in_dst_to: params.maxNights,
      };
    }

    return {
      ...base,
      return_from: toUpstreamDate(params.returnDateFrom ?? params.departDateFrom),
      return_to: toUpstreamDate(
        params.returnDateTo ?? params.returnDateFrom ?? params.departDateFrom,
      ),
    };
  }
}
