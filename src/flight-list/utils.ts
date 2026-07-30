import { FlightlistApiError } from "./errors.ts";

/** Converts a `YYYY-MM-DD` date into the `DD/MM/YYYY` format flightlist.io expects. */
export const toUpstreamDate = (isoDate: string): string => {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
};

/** Extracts the JSON array embedded in flightlist.io's JS-wrapped dataset text. */
export const extractJsonArray = (text: string): unknown[] => {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new FlightlistApiError("Unexpected dataset format from flightlist.io.");
  }
  return JSON.parse(text.slice(start, end + 1));
};
