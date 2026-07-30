/**
 * Minimal typing for flightlist.io's static `locations.js` / `airlines.js`
 * datasets — only the fields LocationResolver actually reads. Airports,
 * cities and countries expose a `code`; regions only expose `id` (which, for
 * a region, is itself the comma-separated list of ISO country codes to send
 * upstream).
 */
export interface LocationEntry {
  type: "airport" | "city" | "country" | "region";
  id: string;
  code?: string;
  name: string;
  active?: boolean;
  slug?: string;
  slug_en?: string;
  alternative_names?: string[];
}

export interface AirlineEntry {
  id: string;
  name: string;
}
