import { getSettings } from "@/lib/queries/settings";
import { listAllAccounts } from "@/lib/actions/accounts";
import { AiSettingsForm } from "@/components/settings/AiSettingsForm";
import { AccountsManager } from "@/components/settings/AccountsManager";
import { DataManager } from "@/components/settings/DataManager";
import { TradingViewSettings } from "@/components/settings/TradingViewSettings";
import { DEFAULT_CDP_PORT } from "@/lib/tradingview/cdp";

export default async function SettingsPage() {
  const [settings, accounts] = await Promise.all([getSettings(), listAllAccounts()]);

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold text-text">Settings</h1>

      <section>
        <h2 className="mb-1 text-lg font-medium text-text">AI / API</h2>
        <p className="mb-4 text-sm text-text-faint">
          Connect your local Omniroute gateway (or any OpenAI-compatible endpoint) to power AI
          Insights, report narratives, notebook writing assist, and backtest summaries.
        </p>
        <AiSettingsForm
          initialBaseUrl={settings.aiBaseUrl ?? ""}
          hasApiKey={Boolean(settings.aiApiKey)}
          initialModel={settings.aiModel ?? ""}
        />
      </section>

      <section>
        <h2 className="mb-1 text-lg font-medium text-text">TradingView</h2>
        <p className="mb-4 text-sm text-text-faint">
          Sync Paper Trading straight out of TradingView Desktop — no CSV export needed. The app
          talks to the running TradingView over Chromium&apos;s remote-debugging port and only ever
          reads; it can&apos;t place or change orders.
        </p>
        <TradingViewSettings initialPort={settings.tradingViewPort ?? DEFAULT_CDP_PORT} />
      </section>

      <section>
        <h2 className="mb-1 text-lg font-medium text-text">Accounts</h2>
        <p className="mb-4 text-sm text-text-faint">
          Every trading, prop, and backtesting account lives here. Starting balance drives the
          dashboard&apos;s %-view toggle and prop account balance tracking.
        </p>
        <AccountsManager accounts={accounts} />
      </section>

      <section>
        <h2 className="mb-1 text-lg font-medium text-text">Data</h2>
        <p className="mb-4 text-sm text-text-faint">
          This app is self-hosted — the SQLite file on disk is your only copy. Export a backup
          periodically, especially before a reset.
        </p>
        <DataManager />
      </section>
    </div>
  );
}
