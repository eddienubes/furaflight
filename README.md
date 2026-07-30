# flightlist-mcp

An MCP (Model Context Protocol) server exposing a single `search` tool that
wraps [flightlist.io](https://www.flightlist.io)'s unauthenticated flight
search API, so an LLM can search flights — including flexible date-range and
duration-of-stay searches — without needing to know IATA codes or the
upstream API's parameter names.

## Requirements

- [Bun](https://bun.sh)

## Install & run

```sh
bun install
bun run src/index.ts
```

The server speaks MCP over stdio. Point your MCP client (Claude Code, Claude
Desktop, etc.) at `bun run <path-to-repo>/src/index.ts`, or run it directly
via its `bin` entry once installed as a dependency.

## The `search` tool

- `from` / `to` (required): IATA/ISO codes or free-text place names
  (airports, cities, countries, regions), comma-separated for multiple
  values.
- `flightType`: `'oneway'` or `'return'`.
  - `oneway` takes `departDateFrom` (+ optional `departDateTo` for a
    flexible date range).
  - `return` requires `returnMode`:
    - `'dates'` — `departDateFrom`/`departDateTo` plus `returnDateFrom`
      (required) / `returnDateTo`.
    - `'nights'` — `departDateFrom`/`departDateTo` plus `minNights` and
      `maxNights` (both required).
- `adults` (default `1`), `children`, `infants`.
- `cabinClass` (default `'M'`, economy).
- `currency` (default `'USD'`).
- `maxStops` (optional; `0` for nonstop only).
- `limit` (default `20`, hard cap `50`).
- `sort` (default `'price'`).

Ambiguous or unresolvable `from`/`to` values fail with a tool error listing
candidate matches. A search with no matching flights is a normal (non-error)
result, not a failure.

## Development

```sh
bun test          # contract tests: schema validation + output normalization
bun run lint      # oxlint
bun run format    # oxfmt
```

The location/airline datasets are fetched from flightlist.io at runtime and
cached to disk for about a week; automated tests never hit the network.
