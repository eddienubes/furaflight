import { FlightlistApiError, FlightlistTimeoutError } from "./errors.ts";

/** Converts a `YYYY-MM-DD` date into the `DD/MM/YYYY` format flightlist.io expects. */
export const toUpstreamDate = (isoDate: string): string => {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
};

/** Today's date as an ISO `YYYY-MM-DD` string. */
export const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

/** Extracts the JSON array embedded in flightlist.io's JS-wrapped dataset text. */
export const extractJsonArray = (text: string): unknown[] => {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new FlightlistApiError("Unexpected dataset format from flightlist.io.");
  }
  return JSON.parse(text.slice(start, end + 1));
};

/** Wraps `fetch` with a timeout, converting an abort into a `FlightlistTimeoutError`. */
export const fetchWithTimeout = async (url: string, timeoutMs: number): Promise<Response> => {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new FlightlistTimeoutError(`Request to ${url} timed out after ${timeoutMs}ms.`);
    }
    throw error;
  }
};
