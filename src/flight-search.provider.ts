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
