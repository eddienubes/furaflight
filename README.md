# furaflight

An MCP (Model Context Protocol) server exposing a single `search` tool that
wraps [flightlist.io](https://www.flightlist.io)'s unauthenticated flight
search API, so an LLM can search flights — including flexible date-range and
duration-of-stay searches — without needing to know IATA codes or the
upstream API's parameter names.

## Use as an MCP server

The server speaks MCP over stdio and is published to npm as `@furaflight/mcp`
with precompiled binaries for every major platform — no local Bun/Node setup
needed. Add it to your MCP client's config:

```json
{
  "mcpServers": {
    "furaflight": {
      "command": "npx",
      "args": ["-y", "@furaflight/mcp"]
    }
  }
}
```

For Claude Code specifically, you can instead register it via the CLI:

```sh
claude mcp add furaflight -- npx -y @furaflight/mcp
```

## Development

```sh
bun install
bun run src/main.ts
```
