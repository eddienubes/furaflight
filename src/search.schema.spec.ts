import { describe, expect, it } from "bun:test";
import { searchInputSchema } from "./search.schema.ts";

const futureDate = (daysFromNow: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
};

describe("searchInputSchema — valid shapes", () => {
  it("should accept a minimal oneway search and apply defaults", () => {
    const result = searchInputSchema.safeParse({
      query: {
        flightType: "oneway",
        from: "CDG",
        to: "SOF",
        departDateFrom: futureDate(10),
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.query.adults).toBe(1);
    expect(result.data.query.children).toBe(0);
    expect(result.data.query.infants).toBe(0);
    expect(result.data.query.cabinClass).toBe("M");
    expect(result.data.query.currency).toBe("USD");
    expect(result.data.query.limit).toBe(20);
    expect(result.data.query.sort).toBe("price");
  });

  it("should accept oneway with a departDateTo range", () => {
    const result = searchInputSchema.safeParse({
      query: {
        flightType: "oneway",
        from: "CDG",
        to: "SOF",
        departDateFrom: futureDate(10),
        departDateTo: futureDate(20),
      },
    });
    expect(result.success).toBe(true);
  });

  it("should accept return with returnMode 'dates'", () => {
    const result = searchInputSchema.safeParse({
      query: {
        flightType: "return",
        returnMode: "dates",
        from: "CDG",
        to: "SOF",
        departDateFrom: futureDate(10),
        returnDateFrom: futureDate(17),
      },
    });
    expect(result.success).toBe(true);
  });

  it("should accept return with returnMode 'nights'", () => {
    const result = searchInputSchema.safeParse({
      query: {
        flightType: "return",
        returnMode: "nights",
        from: "CDG",
        to: "SOF",
        departDateFrom: futureDate(10),
        minNights: 3,
        maxNights: 7,
      },
    });
    expect(result.success).toBe(true);
  });

  it("should accept comma-separated from/to", () => {
    const result = searchInputSchema.safeParse({
      query: {
        flightType: "oneway",
        from: "CDG,ORY",
        to: "SOF,VAR",
        departDateFrom: futureDate(10),
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("searchInputSchema — rejects invalid shapes", () => {
  it("should reject returnMode 'dates' mixed with minNights", () => {
    const result = searchInputSchema.safeParse({
      query: {
        flightType: "return",
        returnMode: "dates",
        from: "CDG",
        to: "SOF",
        departDateFrom: futureDate(10),
        returnDateFrom: futureDate(17),
        minNights: 3,
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject returnMode 'nights' mixed with returnDateFrom", () => {
    const result = searchInputSchema.safeParse({
      query: {
        flightType: "return",
        returnMode: "nights",
        from: "CDG",
        to: "SOF",
        departDateFrom: futureDate(10),
        returnDateFrom: futureDate(17),
        minNights: 3,
        maxNights: 7,
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject returnMode 'dates' missing returnDateFrom", () => {
    const result = searchInputSchema.safeParse({
      query: {
        flightType: "return",
        returnMode: "dates",
        from: "CDG",
        to: "SOF",
        departDateFrom: futureDate(10),
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject returnMode 'nights' missing maxNights", () => {
    const result = searchInputSchema.safeParse({
      query: {
        flightType: "return",
        returnMode: "nights",
        from: "CDG",
        to: "SOF",
        departDateFrom: futureDate(10),
        minNights: 3,
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject minNights greater than maxNights", () => {
    const result = searchInputSchema.safeParse({
      query: {
        flightType: "return",
        returnMode: "nights",
        from: "CDG",
        to: "SOF",
        departDateFrom: futureDate(10),
        minNights: 10,
        maxNights: 3,
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject a departDateFrom in the past", () => {
    const result = searchInputSchema.safeParse({
      query: {
        flightType: "oneway",
        from: "CDG",
        to: "SOF",
        departDateFrom: futureDate(-5),
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject departDateTo before departDateFrom", () => {
    const result = searchInputSchema.safeParse({
      query: {
        flightType: "oneway",
        from: "CDG",
        to: "SOF",
        departDateFrom: futureDate(10),
        departDateTo: futureDate(5),
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject returnDateTo before returnDateFrom", () => {
    const result = searchInputSchema.safeParse({
      query: {
        flightType: "return",
        returnMode: "dates",
        from: "CDG",
        to: "SOF",
        departDateFrom: futureDate(10),
        returnDateFrom: futureDate(17),
        returnDateTo: futureDate(12),
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject an invalid date format", () => {
    const result = searchInputSchema.safeParse({
      query: {
        flightType: "oneway",
        from: "CDG",
        to: "SOF",
        departDateFrom: "30/07/2026",
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject an invalid calendar date", () => {
    const result = searchInputSchema.safeParse({
      query: {
        flightType: "oneway",
        from: "CDG",
        to: "SOF",
        departDateFrom: "2026-02-30",
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject a limit above the hard cap of 50", () => {
    const result = searchInputSchema.safeParse({
      query: {
        flightType: "oneway",
        from: "CDG",
        to: "SOF",
        departDateFrom: futureDate(10),
        limit: 100,
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject an invalid cabinClass", () => {
    const result = searchInputSchema.safeParse({
      query: {
        flightType: "oneway",
        from: "CDG",
        to: "SOF",
        departDateFrom: futureDate(10),
        cabinClass: "X",
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject flightType 'return' missing returnMode", () => {
    const result = searchInputSchema.safeParse({
      query: {
        flightType: "return",
        from: "CDG",
        to: "SOF",
        departDateFrom: futureDate(10),
        returnDateFrom: futureDate(17),
      },
    });
    expect(result.success).toBe(false);
  });

  it("should reject a missing flightType", () => {
    const result = searchInputSchema.safeParse({
      query: {
        from: "CDG",
        to: "SOF",
        departDateFrom: futureDate(10),
      },
    });
    expect(result.success).toBe(false);
  });
});
