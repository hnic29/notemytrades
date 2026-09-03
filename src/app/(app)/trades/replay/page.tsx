import { listReplayableTrades } from "@/lib/queries/trades";
import { TradeReplayPicker } from "@/components/trades/TradeReplayPicker";

export default async function TradeReplayIndexPage() {
  const trades = await listReplayableTrades();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text">Trade Replay</h1>
        <p className="text-sm text-text-muted">
          Pick a closed trade and watch the real price action around it, candle by candle.
        </p>
      </div>

      <TradeReplayPicker trades={trades} />
    </div>
  );
}
