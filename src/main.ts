#!/usr/bin/env bun
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FlightlistApiClient } from "./flight-list.api-client.ts";
import { FlightlistProvider } from "./flight-search.provider.ts";
import { LocationResolver } from "./location.resolver.ts";
import { createServer } from "./mcp.server.ts";

const provider = new FlightlistProvider(new FlightlistApiClient(), new LocationResolver());
const server = createServer(provider);

await server.connect(new StdioServerTransport());
