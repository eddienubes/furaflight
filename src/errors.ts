/** Upstream HTTP error, non-2xx response, or malformed JSON from flightlist.io. */
export class FlightlistApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlightlistApiError";
  }
}

/** A fetch to flightlist.io did not complete within the allotted timeout. */
export class FlightlistTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlightlistTimeoutError";
  }
}

/** A `from`/`to` token could not be resolved to exactly one location. */
export class LocationResolutionError extends Error {
  readonly token: string;
  readonly candidates: string[];

  constructor(token: string, candidates: string[]) {
    super(
      candidates.length === 0
        ? `Could not resolve location "${token}".`
        : `"${token}" is ambiguous. Did you mean: ${candidates.join(", ")}?`,
    );
    this.name = "LocationResolutionError";
    this.token = token;
    this.candidates = candidates;
  }
}
