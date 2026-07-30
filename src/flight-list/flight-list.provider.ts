import type {
  FlightlistApiClient,
  FlightlistFlight,
  FlightlistSearchRequestParams,
} from "./flight-list.api-client.ts";
import type { LocationResolver } from "./flight-list.location-resolver.ts";
import { toUpstreamDate } from "./flight-list.utils.ts";
import type {
  FlightSearchProvider,
  NormalizedFlight,
  NormalizedSearchParams,
} from "../flight-search.provider.ts";

export class FlightlistProvider implements FlightSearchProvider {
  private readonly client: FlightlistApiClient;
  private readonly locationResolver: LocationResolver;

  constructor(client: FlightlistApiClient, locationResolver: LocationResolver) {
    this.client = client;
    this.locationResolver = locationResolver;
  }

  async search(params: NormalizedSearchParams): Promise<NormalizedFlight[]> {
    const flyFrom = this.locationResolver.resolve(params.from);
    const flyTo = this.locationResolver.resolve(params.to);

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

    let requestParams: FlightlistSearchRequestParams = base;
    if (params.flightType === "return") {
      requestParams =
        params.returnMode === "nights"
          ? { ...base, nights_in_dst_from: params.minNights, nights_in_dst_to: params.maxNights }
          : {
              ...base,
              return_from: toUpstreamDate(params.returnDateFrom ?? params.departDateFrom),
              return_to: toUpstreamDate(
                params.returnDateTo ?? params.returnDateFrom ?? params.departDateFrom,
              ),
            };
    }

    const response = await this.client.search(requestParams);
    const airlineNames = this.locationResolver.airlineNames();

    return response.data.map((flight) =>
      this.normalizeFlight(flight, response.currency, airlineNames),
    );
  }

  private normalizeFlight(
    flight: FlightlistFlight,
    currency: string,
    airlineNames: ReadonlyMap<string, string>,
  ): NormalizedFlight {
    const resolveAirline = (code: string) => airlineNames.get(code) ?? code;
    const outboundLegCount = flight.route.filter((leg) => leg.return === 0).length;
    const returnLegCount = flight.route.filter((leg) => leg.return === 1).length;
    const isReturnTrip = returnLegCount > 0;

    return {
      price: flight.price,
      currency,
      // route.length - 1 only equals "number of connections" for a single direction:
      // a round trip appends a second direction's legs, and there's no travel between
      // the last outbound leg and the first return leg, so the two directions' stop
      // counts must be computed separately and combined via max, not summed.
      stops: Math.max(outboundLegCount, returnLegCount) - 1,
      airlines: [...new Set(flight.airlines)].map(resolveAirline),
      departure: flight.local_departure,
      arrival: flight.local_arrival,
      duration: {
        departure: flight.duration.departure,
        ...(isReturnTrip ? { return: flight.duration.return } : {}),
        total: flight.duration.total,
      },
      legs: flight.route.map((leg) => ({
        from: leg.flyFrom,
        to: leg.flyTo,
        departure: leg.local_departure,
        arrival: leg.local_arrival,
        airline: resolveAirline(leg.airline),
        flightNumber: `${leg.airline}${leg.flight_no}`,
      })),
    };
  }
}
