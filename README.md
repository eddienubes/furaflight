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
bun run src/main.ts
```

The server speaks MCP over stdio. Point your MCP client (Claude Code, Claude
Desktop, etc.) at `bun run <path-to-repo>/src/main.ts`, or run it directly
via its `bin` entry once installed as a dependency.