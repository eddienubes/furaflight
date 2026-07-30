#!/usr/bin/env bun
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FlightlistApiClient } from "./flight-list/flight-list.api-client.ts";
import { LocationResolver } from "./flight-list/flight-list.location-resolver.ts";
import { FlightlistProvider } from "./flight-list/flight-list.provider.ts";
import { createServer } from "./mcp.server.ts";

const provider = new FlightlistProvider(new FlightlistApiClient(), await LocationResolver.create());
const server = createServer(provider);

await server.connect(new StdioServerTransport());
