import type { FlightlistFlight } from "./types/flightlist.ts";

export interface NormalizedFlightLeg {
  from: string;
  to: string;
  departure: string;
  arrival: string;
  airline: string;
  flightNumber: string;
}

export interface NormalizedFlightDuration {
  departure: number;
  return?: number;
  total: number;
}

export interface NormalizedFlight {
  price: number;
  currency: string;
  stops: number;
  airlines: string[];
  departure: string;
  arrival: string;
  duration: NormalizedFlightDuration;
  legs: NormalizedFlightLeg[];
}

/** Trims a full upstream flight result down to what's useful for LLM-driven trip browsing. */
export function normalizeFlight(
  flight: FlightlistFlight,
  currency: string,
  airlineNames: ReadonlyMap<string, string>,
): NormalizedFlight {
  const resolveAirline = (code: string) => airlineNames.get(code) ?? code;
  const isReturnTrip = flight.route.some((leg) => leg.return === 1);

  return {
    price: flight.price,
    currency,
    stops: flight.route.length - 1,
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
