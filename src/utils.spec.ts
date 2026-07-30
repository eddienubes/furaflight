import { describe, expect, it } from "bun:test";
import { FlightlistTimeoutError } from "./errors.ts";
import { fetchWithTimeout } from "./utils.ts";

describe("fetchWithTimeout", () => {
  it("should throw FlightlistTimeoutError when the request times out", async () => {
    // A non-routable address hangs indefinitely (no response, no connection refused),
    // so a 1ms timeout deterministically wins the race without depending on real
    // network conditions or hitting the actual flightlist.io API.
    const unreachableUrl = "http://10.255.255.1/";

    await expect(fetchWithTimeout(unreachableUrl, 1)).rejects.toThrow(FlightlistTimeoutError);
    await expect(fetchWithTimeout(unreachableUrl, 1)).rejects.toThrow(
      `Request to ${unreachableUrl} timed out after 1ms.`,
    );
  });
});
