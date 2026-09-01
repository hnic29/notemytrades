import { describe, expect, it } from "vitest";
import { parseRules } from "./strategies";

describe("parseRules", () => {
  it("returns an empty array for null", () => {
    expect(parseRules(null)).toEqual([]);
  });

  it("returns an empty array for malformed JSON instead of throwing", () => {
    expect(parseRules("{not json")).toEqual([]);
  });

  it("returns an empty array when the JSON isn't an array", () => {
    expect(parseRules('{"foo":"bar"}')).toEqual([]);
  });

  it("parses a valid rule-group array", () => {
    const json = JSON.stringify([{ group: "Entry", rules: ["Above VWAP", "Volume > avg"] }]);
    expect(parseRules(json)).toEqual([{ group: "Entry", rules: ["Above VWAP", "Volume > avg"] }]);
  });
});
