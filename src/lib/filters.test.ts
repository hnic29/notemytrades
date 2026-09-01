import { describe, expect, it } from "vitest";
import { filtersToSearchParams, hasActiveFilters, parseFilters } from "./filters";

describe("parseFilters", () => {
  it("extracts known keys and drops unknown/empty ones", () => {
    const filters = parseFilters({ symbol: "AAPL", from: "2026-01-01", junk: "x", to: "" });
    expect(filters).toEqual({ symbol: "AAPL", from: "2026-01-01" });
  });

  it("takes the first value when a param is repeated", () => {
    const filters = parseFilters({ symbol: ["AAPL", "MSFT"] });
    expect(filters.symbol).toBe("AAPL");
  });
});

describe("filtersToSearchParams / hasActiveFilters", () => {
  it("round-trips a filter set into a query string", () => {
    const qs = filtersToSearchParams({ symbol: "AAPL", side: "long" });
    expect(qs).toBe("?symbol=AAPL&side=long");
  });

  it("returns an empty string for no filters", () => {
    expect(filtersToSearchParams({})).toBe("");
    expect(hasActiveFilters({})).toBe(false);
  });

  it("reports active filters", () => {
    expect(hasActiveFilters({ symbol: "AAPL" })).toBe(true);
  });
});
