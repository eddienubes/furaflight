import { describe, expect, it } from "bun:test";
import {
  FlightlistApiClient,
  type FlightlistSearchRequestParams,
} from "./flight-list.api-client.ts";
import { FlightlistTimeoutError } from "./flight-list.errors.ts";

const params: FlightlistSearchRequestParams = {
  fly_from: "CDG",
  fly_to: "SOF",
  date_from: "30/07/2026",
  date_to: "30/07/2026",
  adults: 1,
  children: 0,
  infants: 0,
  selected_cabins: "M",
  curr: "USD",
  limit: 20,
  sort: "price",
  stopover_from: "00:00",
  stopover_to: "48:00",
  ret_from_diff_city: false,
  ret_to_diff_city: false,
  dtime_from: "00:00",
  dtime_to: "23:59",
  enable_vi: true,
  flight_type: "oneway",
  adult_hand_bag: 0,
  adult_hold_bag: 0,
};

describe(FlightlistApiClient.name, () => {
  describe(FlightlistApiClient.prototype.search.name, () => {
    it("should throw FlightlistTimeoutError when the request times out", async () => {
      // A non-routable address hangs indefinitely (no response, no connection refused),
      // so a 1ms timeout deterministically wins the race without depending on real
      // network conditions or hitting the actual flightlist.io API.
      const unreachableUrl = "http://10.255.255.1/";
      const client = new FlightlistApiClient(1, unreachableUrl);

      await expect(client.search(params)).rejects.toThrow(FlightlistTimeoutError);
      await expect(client.search(params)).rejects.toThrow(/timed out after 1ms\.$/);
    });
  });
});
