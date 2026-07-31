import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FlightSearchProvider } from "./flight-search.provider.ts";
import { searchInputSchema } from "./search.schema.ts";

export const createServer = (provider: FlightSearchProvider): McpServer => {
  const server = new McpServer({ name: "flightlist-mcp", version: "0.1.0" });

  server.registerTool(
    "search",
    {
      title: "Search flights",
      description: `Search flights via flightlist.io. Supports one-way, round-trip-by-dates, and \
round-trip-by-duration-of-stay searches. \`from\`/\`to\` accept IATA/ISO codes or \
free-text place names, comma-separated for multiple values.`,
      inputSchema: searchInputSchema,
    },
    async (args) => {
      const flights = await provider.search(args.query);
      if (flights.length === 0) {
        return { content: [{ type: "text", text: "No flights found for these criteria." }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(flights, null, 2) }] };
    },
  );

  return server;
};
