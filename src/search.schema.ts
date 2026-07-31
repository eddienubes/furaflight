import { z } from "zod";
import { todayIsoDate } from "./utils.ts";

const isValidIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

const dateStringSchema = z
  .string()
  .refine(isValidIsoDate, { message: "must be a valid date in YYYY-MM-DD format" });

const commonShape = {
  from: z
    .string()
    .min(1)
    .describe(
      "Origin airport/city/country/region, as an IATA/ISO code or free-text name. Comma-separate multiple values.",
    ),
  to: z
    .string()
    .min(1)
    .describe(
      "Destination airport/city/country/region, as an IATA/ISO code or free-text name. Comma-separate multiple values.",
    ),
  adults: z.number().int().min(1).default(1).describe("Number of adult passengers."),
  children: z.number().int().min(0).default(0).describe("Number of child passengers."),
  infants: z.number().int().min(0).default(0).describe("Number of infant passengers."),
  cabinClass: z
    .enum(["M", "W", "C", "F"])
    .default("M")
    .describe("Cabin class: M=economy, W=premium economy, C=business, F=first."),
  currency: z.string().min(1).default("USD").describe("Currency code for prices, e.g. USD, EUR."),
  maxStops: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Maximum stops per leg; 0 means nonstop only."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Max number of results to return (hard cap 50)."),
  sort: z.enum(["price"]).default("price").describe("Sort order for results."),
};

const onewaySchema = z.object({
  flightType: z.literal("oneway"),
  departDateFrom: dateStringSchema.describe("Earliest departure date (YYYY-MM-DD)."),
  departDateTo: dateStringSchema
    .optional()
    .describe(
      "Latest departure date (YYYY-MM-DD); a range beyond a single day triggers a flexible search.",
    ),
  ...commonShape,
});

const returnSchema = z.object({
  flightType: z.literal("return"),
  returnMode: z
    .enum(["dates", "nights"])
    .describe("'dates' for an explicit return window, 'nights' for a duration-of-stay search."),
  departDateFrom: dateStringSchema.describe("Earliest departure date (YYYY-MM-DD)."),
  departDateTo: dateStringSchema
    .optional()
    .describe(
      "Latest departure date (YYYY-MM-DD); a range beyond a single day triggers a flexible search.",
    ),
  returnDateFrom: dateStringSchema
    .optional()
    .describe("Earliest return date (YYYY-MM-DD). Required when returnMode is 'dates'."),
  returnDateTo: dateStringSchema.optional().describe("Latest return date (YYYY-MM-DD)."),
  minNights: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Minimum nights at destination. Required when returnMode is 'nights'."),
  maxNights: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Maximum nights at destination. Required when returnMode is 'nights'."),
  ...commonShape,
});

const searchQuerySchema = z
  .discriminatedUnion("flightType", [onewaySchema, returnSchema])
  .superRefine((data, ctx) => {
    if (data.departDateFrom < todayIsoDate()) {
      ctx.addIssue({
        code: "custom",
        message: "departDateFrom cannot be in the past.",
        path: ["departDateFrom"],
      });
    }
    if (data.departDateTo !== undefined && data.departDateTo < data.departDateFrom) {
      ctx.addIssue({
        code: "custom",
        message: "departDateTo cannot be before departDateFrom.",
        path: ["departDateTo"],
      });
    }

    if (data.flightType !== "return") return;

    if (data.returnMode === "dates") {
      if (data.returnDateFrom === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "returnDateFrom is required when returnMode is 'dates'.",
          path: ["returnDateFrom"],
        });
      }
      if (data.minNights !== undefined || data.maxNights !== undefined) {
        ctx.addIssue({
          code: "custom",
          message: "minNights/maxNights must not be set when returnMode is 'dates'.",
          path: ["minNights"],
        });
      }
      if (
        data.returnDateFrom !== undefined &&
        data.returnDateTo !== undefined &&
        data.returnDateTo < data.returnDateFrom
      ) {
        ctx.addIssue({
          code: "custom",
          message: "returnDateTo cannot be before returnDateFrom.",
          path: ["returnDateTo"],
        });
      }
    } else {
      if (data.minNights === undefined || data.maxNights === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "minNights and maxNights are both required when returnMode is 'nights'.",
          path: ["minNights"],
        });
      }
      if (data.returnDateFrom !== undefined || data.returnDateTo !== undefined) {
        ctx.addIssue({
          code: "custom",
          message: "returnDateFrom/returnDateTo must not be set when returnMode is 'nights'.",
          path: ["returnDateFrom"],
        });
      }
      if (
        data.minNights !== undefined &&
        data.maxNights !== undefined &&
        data.minNights > data.maxNights
      ) {
        ctx.addIssue({
          code: "custom",
          message: "minNights cannot be greater than maxNights.",
          path: ["maxNights"],
        });
      }
    }
  });

export const searchInputSchema = z.object({ query: searchQuerySchema });

export type SearchInput = z.infer<typeof searchInputSchema>;
