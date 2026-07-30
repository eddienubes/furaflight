#!/usr/bin/env bun
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FlightlistApiClient } from "./flightlistApiClient.ts";
import { LocationResolver } from "./locationResolver.ts";
import { FlightlistProvider } from "./provider.ts";
import { createServer } from "./server.ts";

const provider = new FlightlistProvider(new FlightlistApiClient(), new LocationResolver());
const server = createServer(provider);

await server.connect(new StdioServerTransport());
