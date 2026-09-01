import { getSettings } from "@/lib/queries/settings";
import { listAllAccounts } from "@/lib/actions/accounts";
import { AiSettingsForm } from "@/components/settings/AiSettingsForm";
import { AccountsManager } from "@/components/settings/AccountsManager";

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
          initialApiKey={settings.aiApiKey ?? ""}
          initialModel={settings.aiModel ?? ""}
        />
      </section>

      <section>
        <h2 className="mb-1 text-lg font-medium text-text">Accounts</h2>
        <p className="mb-4 text-sm text-text-faint">
          Every trading, prop, and backtesting account lives here. Starting balance drives the
          dashboard&apos;s %-view toggle and prop account balance tracking.
        </p>
        <AccountsManager accounts={accounts} />
      </section>
    </div>
  );
}
