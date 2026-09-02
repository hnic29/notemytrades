import { describe, expect, it } from "vitest";
import { ASSET_CLASS_LABELS, getTemplate, STRATEGY_TEMPLATES } from "./templates";

describe("STRATEGY_TEMPLATES", () => {
  it("has unique slugs", () => {
    const slugs = STRATEGY_TEMPLATES.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("covers every asset class at least once", () => {
    const covered = new Set(STRATEGY_TEMPLATES.map((t) => t.assetType));
    for (const assetClass of Object.keys(ASSET_CLASS_LABELS)) {
      expect(covered.has(assetClass as keyof typeof ASSET_CLASS_LABELS)).toBe(true);
    }
  });

  it("every template has a name, description, and at least one non-empty rule group", () => {
    for (const t of STRATEGY_TEMPLATES) {
      expect(t.name.trim()).not.toBe("");
      expect(t.description.trim()).not.toBe("");
      expect(t.rules.length).toBeGreaterThan(0);
      for (const group of t.rules) {
        expect(group.group.trim()).not.toBe("");
        expect(group.rules.length).toBeGreaterThan(0);
        for (const rule of group.rules) {
          expect(rule.trim()).not.toBe("");
        }
      }
    }
  });
});

describe("getTemplate", () => {
  it("finds a template by slug", () => {
    expect(getTemplate("opening-range-breakout")?.name).toBe("Opening Range Breakout");
  });

  it("returns undefined for an unknown slug", () => {
    expect(getTemplate("does-not-exist")).toBeUndefined();
  });
});
