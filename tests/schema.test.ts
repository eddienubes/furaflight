import { describe, expect, test } from "bun:test";
import { searchInputSchema } from "../src/schema.ts";

function futureDate(daysFromNow: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

describe("searchInputSchema — valid shapes", () => {
  test("accepts a minimal oneway search and applies defaults", () => {
    const result = searchInputSchema.safeParse({
      flightType: "oneway",
      from: "CDG",
      to: "SOF",
      departDateFrom: futureDate(10),
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.adults).toBe(1);
    expect(result.data.children).toBe(0);
    expect(result.data.infants).toBe(0);
    expect(result.data.cabinClass).toBe("M");
    expect(result.data.currency).toBe("USD");
    expect(result.data.limit).toBe(20);
    expect(result.data.sort).toBe("price");
  });

  test("accepts oneway with a departDateTo range", () => {
    const result = searchInputSchema.safeParse({
      flightType: "oneway",
      from: "CDG",
      to: "SOF",
      departDateFrom: futureDate(10),
      departDateTo: futureDate(20),
    });
    expect(result.success).toBe(true);
  });

  test("accepts return with returnMode 'dates'", () => {
    const result = searchInputSchema.safeParse({
      flightType: "return",
      returnMode: "dates",
      from: "CDG",
      to: "SOF",
      departDateFrom: futureDate(10),
      returnDateFrom: futureDate(17),
    });
    expect(result.success).toBe(true);
  });

  test("accepts return with returnMode 'nights'", () => {
    const result = searchInputSchema.safeParse({
      flightType: "return",
      returnMode: "nights",
      from: "CDG",
      to: "SOF",
      departDateFrom: futureDate(10),
      minNights: 3,
      maxNights: 7,
    });
    expect(result.success).toBe(true);
  });

  test("accepts comma-separated from/to", () => {
    const result = searchInputSchema.safeParse({
      flightType: "oneway",
      from: "CDG,ORY",
      to: "SOF,VAR",
      departDateFrom: futureDate(10),
    });
    expect(result.success).toBe(true);
  });
});

describe("searchInputSchema — rejects invalid shapes", () => {
  test("rejects returnMode 'dates' mixed with minNights", () => {
    const result = searchInputSchema.safeParse({
      flightType: "return",
      returnMode: "dates",
      from: "CDG",
      to: "SOF",
      departDateFrom: futureDate(10),
      returnDateFrom: futureDate(17),
      minNights: 3,
    });
    expect(result.success).toBe(false);
  });

  test("rejects returnMode 'nights' mixed with returnDateFrom", () => {
    const result = searchInputSchema.safeParse({
      flightType: "return",
      returnMode: "nights",
      from: "CDG",
      to: "SOF",
      departDateFrom: futureDate(10),
      returnDateFrom: futureDate(17),
      minNights: 3,
      maxNights: 7,
    });
    expect(result.success).toBe(false);
  });

  test("rejects returnMode 'dates' missing returnDateFrom", () => {
    const result = searchInputSchema.safeParse({
      flightType: "return",
      returnMode: "dates",
      from: "CDG",
      to: "SOF",
      departDateFrom: futureDate(10),
    });
    expect(result.success).toBe(false);
  });

  test("rejects returnMode 'nights' missing maxNights", () => {
    const result = searchInputSchema.safeParse({
      flightType: "return",
      returnMode: "nights",
      from: "CDG",
      to: "SOF",
      departDateFrom: futureDate(10),
      minNights: 3,
    });
    expect(result.success).toBe(false);
  });

  test("rejects minNights greater than maxNights", () => {
    const result = searchInputSchema.safeParse({
      flightType: "return",
      returnMode: "nights",
      from: "CDG",
      to: "SOF",
      departDateFrom: futureDate(10),
      minNights: 10,
      maxNights: 3,
    });
    expect(result.success).toBe(false);
  });

  test("rejects a departDateFrom in the past", () => {
    const result = searchInputSchema.safeParse({
      flightType: "oneway",
      from: "CDG",
      to: "SOF",
      departDateFrom: futureDate(-5),
    });
    expect(result.success).toBe(false);
  });

  test("rejects departDateTo before departDateFrom", () => {
    const result = searchInputSchema.safeParse({
      flightType: "oneway",
      from: "CDG",
      to: "SOF",
      departDateFrom: futureDate(10),
      departDateTo: futureDate(5),
    });
    expect(result.success).toBe(false);
  });

  test("rejects returnDateTo before returnDateFrom", () => {
    const result = searchInputSchema.safeParse({
      flightType: "return",
      returnMode: "dates",
      from: "CDG",
      to: "SOF",
      departDateFrom: futureDate(10),
      returnDateFrom: futureDate(17),
      returnDateTo: futureDate(12),
    });
    expect(result.success).toBe(false);
  });

  test("rejects an invalid date format", () => {
    const result = searchInputSchema.safeParse({
      flightType: "oneway",
      from: "CDG",
      to: "SOF",
      departDateFrom: "30/07/2026",
    });
    expect(result.success).toBe(false);
  });

  test("rejects an invalid calendar date", () => {
    const result = searchInputSchema.safeParse({
      flightType: "oneway",
      from: "CDG",
      to: "SOF",
      departDateFrom: "2026-02-30",
    });
    expect(result.success).toBe(false);
  });

  test("rejects a limit above the hard cap of 50", () => {
    const result = searchInputSchema.safeParse({
      flightType: "oneway",
      from: "CDG",
      to: "SOF",
      departDateFrom: futureDate(10),
      limit: 100,
    });
    expect(result.success).toBe(false);
  });

  test("rejects an invalid cabinClass", () => {
    const result = searchInputSchema.safeParse({
      flightType: "oneway",
      from: "CDG",
      to: "SOF",
      departDateFrom: futureDate(10),
      cabinClass: "X",
    });
    expect(result.success).toBe(false);
  });

  test("rejects a missing flightType", () => {
    const result = searchInputSchema.safeParse({
      from: "CDG",
      to: "SOF",
      departDateFrom: futureDate(10),
    });
    expect(result.success).toBe(false);
  });
});
