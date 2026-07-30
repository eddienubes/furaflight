import { describe, expect, test } from "bun:test";
import type { FlightlistFlight } from "../src/flight-list.api-client.ts";
import { FlightNormalizer } from "../src/flight.normalizer.ts";

const normalizer = new FlightNormalizer();

// Trimmed fixture based on a real flightlist.io response (oneway, one connection).
const onewayFlight: FlightlistFlight = {
  id: "25c30f5850b80000b3715262_0|25c30f5850b80000b3715262_1",
  flyFrom: "CDG",
  flyTo: "SOF",
  cityFrom: "Paris",
  cityCodeFrom: "PAR",
  cityTo: "Sofia",
  cityCodeTo: "SOF",
  countryFrom: { code: "FR", name: "France" },
  countryTo: { code: "BG", name: "Bulgaria" },
  local_departure: "2026-07-30T14:15:00.000Z",
  utc_departure: "2026-07-30T12:15:00.000Z",
  local_arrival: "2026-07-30T23:15:00.000Z",
  utc_arrival: "2026-07-30T20:15:00.000Z",
  nightsInDest: null,
  quality: 308,
  distance: 1756.01,
  duration: { departure: 28800, return: 0, total: 28800 },
  price: 224,
  conversion: { EUR: 224 },
  fare: { adults: 224, children: 0, infants: 0 },
  bags_price: { "1": 100, "2": 270 },
  bags_conversion: { EUR: { "1": 100, "2": 270 } },
  baglimit: {
    hold_dimensions_sum: 158,
    hold_height: 52,
    hold_length: 78,
    hold_weight: 23,
    hold_width: 28,
    personal_item_dimensions_sum: 85,
    personal_item_height: 30,
    personal_item_length: 40,
    personal_item_weight: 4,
    personal_item_width: 15,
  },
  availability: { seats: null },
  airlines: ["LH"],
  route: [
    {
      id: "25c30f5850b80000b3715262_0",
      combination_id: "25c30f5850b80000b3715262",
      flyFrom: "CDG",
      flyTo: "MUC",
      cityFrom: "Paris",
      cityCodeFrom: "PAR",
      cityTo: "Munich",
      cityCodeTo: "MUC",
      local_departure: "2026-07-30T14:15:00.000Z",
      utc_departure: "2026-07-30T12:15:00.000Z",
      local_arrival: "2026-07-30T15:45:00.000Z",
      utc_arrival: "2026-07-30T13:45:00.000Z",
      airline: "LH",
      flight_no: 4195,
      operating_carrier: "VL",
      operating_flight_no: "",
      fare_basis: "SETLGTU9",
      fare_category: "M",
      fare_classes: "S",
      return: 0,
      bags_recheck_required: false,
      vi_connection: false,
      guarantee: false,
      equipment: null,
      vehicle_type: "aircraft",
    },
    {
      id: "25c30f5850b80000b3715262_1",
      combination_id: "25c30f5850b80000b3715262",
      flyFrom: "MUC",
      flyTo: "SOF",
      cityFrom: "Munich",
      cityCodeFrom: "MUC",
      cityTo: "Sofia",
      cityCodeTo: "SOF",
      local_departure: "2026-07-30T20:20:00.000Z",
      utc_departure: "2026-07-30T18:20:00.000Z",
      local_arrival: "2026-07-30T23:15:00.000Z",
      utc_arrival: "2026-07-30T20:15:00.000Z",
      airline: "LH",
      flight_no: 1706,
      operating_carrier: "LH",
      operating_flight_no: "1706",
      fare_basis: "SETLGTU9",
      fare_category: "M",
      fare_classes: "S",
      return: 0,
      bags_recheck_required: false,
      vi_connection: false,
      guarantee: false,
      equipment: null,
      vehicle_type: "aircraft",
    },
  ],
  booking_token: "token",
  deep_link: "https://www.kiwi.com/deep?booking_token=token",
  facilitated_booking_available: true,
  pnr_count: 1,
  has_airport_change: false,
  technical_stops: 0,
  throw_away_ticketing: false,
  hidden_city_ticketing: false,
  virtual_interlining: false,
};

describe("FlightNormalizer.normalize", () => {
  test("trims a oneway upstream flight to the documented shape", () => {
    const airlineNames = new Map([["LH", "Lufthansa"]]);
    const normalized = normalizer.normalize(onewayFlight, "EUR", airlineNames);

    expect(normalized).toEqual({
      price: 224,
      currency: "EUR",
      stops: 1,
      airlines: ["Lufthansa"],
      departure: "2026-07-30T14:15:00.000Z",
      arrival: "2026-07-30T23:15:00.000Z",
      duration: { departure: 28800, total: 28800 },
      legs: [
        {
          from: "CDG",
          to: "MUC",
          departure: "2026-07-30T14:15:00.000Z",
          arrival: "2026-07-30T15:45:00.000Z",
          airline: "Lufthansa",
          flightNumber: "LH4195",
        },
        {
          from: "MUC",
          to: "SOF",
          departure: "2026-07-30T20:20:00.000Z",
          arrival: "2026-07-30T23:15:00.000Z",
          airline: "Lufthansa",
          flightNumber: "LH1706",
        },
      ],
    });
  });

  test("falls back to the raw airline code when no name is known", () => {
    const normalized = normalizer.normalize(onewayFlight, "EUR", new Map());
    expect(normalized.airlines).toEqual(["LH"]);
    expect(normalized.legs[0]?.airline).toBe("LH");
  });

  test("includes duration.return only for round trips", () => {
    const returnLeg = {
      ...onewayFlight.route[0]!,
      id: "return_0",
      return: 1,
    };
    const returnFlight: FlightlistFlight = {
      ...onewayFlight,
      duration: { departure: 28800, return: 30000, total: 58800 },
      route: [...onewayFlight.route, returnLeg],
    };

    const normalized = normalizer.normalize(returnFlight, "EUR", new Map());
    expect(normalized.duration).toEqual({ departure: 28800, return: 30000, total: 58800 });
    // Outbound has a connection (2 legs -> 1 stop), return is nonstop (1 leg -> 0 stops).
    // stops must reflect the per-direction max, not the combined route length (which
    // would wrongly give 3 legs - 1 = 2).
    expect(normalized.stops).toBe(1);
  });

  test("computes stops per direction for a nonstop-both-ways round trip", () => {
    const outboundLeg = { ...onewayFlight.route[0]!, id: "out_0", return: 0 };
    const returnLeg = { ...onewayFlight.route[0]!, id: "return_0", return: 1 };
    const nonstopRoundTrip: FlightlistFlight = {
      ...onewayFlight,
      duration: { departure: 5400, return: 5400, total: 10800 },
      route: [outboundLeg, returnLeg],
    };

    const normalized = normalizer.normalize(nonstopRoundTrip, "EUR", new Map());
    // Both directions are nonstop (1 leg each), so this must be 0, not
    // route.length - 1 (which would wrongly give 2 legs - 1 = 1).
    expect(normalized.stops).toBe(0);
  });

  test("computes stops per direction when the return leg has the connection", () => {
    const outboundLeg = { ...onewayFlight.route[0]!, id: "out_0", return: 0 };
    const returnLegs = onewayFlight.route.map((leg, index) => ({
      ...leg,
      id: `return_${index}`,
      return: 1 as const,
    }));
    const asymmetricRoundTrip: FlightlistFlight = {
      ...onewayFlight,
      duration: { departure: 5400, return: 28800, total: 34200 },
      route: [outboundLeg, ...returnLegs],
    };

    const normalized = normalizer.normalize(asymmetricRoundTrip, "EUR", new Map());
    // Outbound is nonstop (1 leg -> 0 stops), return has a connection (2 legs -> 1 stop).
    expect(normalized.stops).toBe(1);
  });
});
