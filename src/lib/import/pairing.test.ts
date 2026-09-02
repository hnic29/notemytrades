import { describe, expect, it } from "vitest";
import { pairExecutions, type PairingExec } from "./pairing";

const t = (s: string) => new Date(`2026-01-05T${s}:00Z`).toISOString();
let row = 2;
const fill = (
  side: "buy" | "sell",
  qty: number,
  price: number,
  time: string,
  extra: Partial<PairingExec> = {},
): PairingExec => ({ rowNum: row++, symbol: "MNQ", side, qty, price, time: t(time), ...extra });

describe("pairExecutions with inferred open/close (netting)", () => {
  it("treats a fill against the current position as a close and anything else as an open", () => {
    const r = pairExecutions([
      fill("buy", 1, 100, "09:00"),
      fill("sell", 1, 110, "09:05"),
      fill("sell", 1, 111, "09:06"),
      fill("buy", 1, 105, "09:10"),
    ]);
    expect(r.errors).toEqual([]);
    expect(r.trades.map((x) => [x.side, x.avgEntryPrice, x.avgExitPrice, x.netPnl])).toEqual([
      ["long", 100, 110, 10],
      ["short", 111, 105, 6],
    ]);
    expect(r.openLots.size).toBe(0);
  });

  it("splits a reversal fill into a close and a new open the other way", () => {
    const r = pairExecutions([fill("buy", 1, 100, "09:00"), fill("sell", 3, 110, "09:05"), fill("buy", 2, 100, "09:10")]);
    expect(r.errors).toEqual([]);
    expect(r.trades.map((x) => [x.side, x.quantity, x.netPnl])).toEqual([
      ["long", 1, 10],
      ["short", 2, 20],
    ]);
  });

  it("applies the symbol's multiplier to P&L and stamps it on the trade", () => {
    const r = pairExecutions([fill("buy", 1, 100, "09:00"), fill("sell", 1, 110, "09:05")], {
      multiplierFor: () => 2,
    });
    expect(r.trades[0].netPnl).toBe(20);
    expect(r.trades[0].multiplier).toBe(2);
  });

  it("seeds a pre-existing position so the first in-window close pairs correctly, and reports it instead of emitting it", () => {
    // Window starts long 1 from before the export; first fill closes it.
    const r = pairExecutions(
      [fill("sell", 1, 105, "09:00"), fill("sell", 1, 106, "09:01"), fill("buy", 1, 100, "09:05")],
      { seedLots: [{ symbol: "MNQ", side: "long", quantity: 1, price: 102 }] },
    );
    expect(r.seedCloses).toEqual([
      { symbol: "MNQ", side: "long", quantity: 1, closedAt: t("09:00"), netPnl: 3 },
    ]);
    // Without the seed, the 09:00 sell would have opened a short at 105
    // and the 09:05 buy would have closed *that* instead of the 106 lot.
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0]).toMatchObject({ side: "short", avgEntryPrice: 106, avgExitPrice: 100, netPnl: 6 });
  });

  it("allocates opening and closing fees proportionally across split lots", () => {
    const r = pairExecutions([
      fill("buy", 2, 100, "09:00", { commissions: 4 }), // $2 per unit
      fill("sell", 1, 110, "09:05", { commissions: 1 }),
      fill("sell", 1, 120, "09:06", { commissions: 1 }),
    ]);
    expect(r.trades.map((x) => x.commissions)).toEqual([3, 3]);
    expect(r.trades.map((x) => x.netPnl)).toEqual([7, 17]);
  });

  it("uses seq to order fills that share a timestamp", () => {
    const r = pairExecutions([
      fill("sell", 1, 110, "09:00", { seq: 2 }),
      fill("buy", 1, 100, "09:00", { seq: 1 }),
    ]);
    expect(r.trades[0]).toMatchObject({ side: "long", netPnl: 10 });
  });

  it("reports leftover open lots", () => {
    const r = pairExecutions([fill("buy", 2, 100, "09:00"), fill("sell", 1, 110, "09:05")]);
    expect(r.openLots.get("MNQ")).toEqual([{ side: "long", quantity: 1, price: 100 }]);
  });
});

describe("pairExecutions with explicit open/close", () => {
  it("errors instead of reversing when a close has nothing to match", () => {
    const r = pairExecutions([fill("sell", 1, 110, "09:00", { posEffect: "close" })]);
    expect(r.trades).toEqual([]);
    expect(r.errors[0].message).toMatch(/no matching open lot/);
  });
});
