"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Wallet,
  Upload,
  CheckCircle2,
  Rocket,
  Search,
} from "lucide-react";
import { createAccount } from "@/lib/actions/accounts";
import {
  updateAiSettings,
  testAiConnection,
  listAiModels,
  markOnboarded,
} from "@/lib/actions/settings";
import { cn } from "@/lib/utils";

const ASSET_TYPES = [
  { value: "mixed", label: "Mixed / General" },
  { value: "stock", label: "Stocks" },
  { value: "futures", label: "Futures" },
  { value: "forex", label: "Forex" },
  { value: "crypto", label: "Crypto" },
  { value: "option", label: "Options" },
];

const STEPS = ["Welcome", "Your Account", "Import", "AI Setup", "Done"];

export function OnboardingWizard({
  defaultAiBaseUrl,
  defaultAiModel,
}: {
  defaultAiBaseUrl: string;
  defaultAiModel: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 2 — account
  const [accountName, setAccountName] = useState("Main Account");
  const [assetType, setAssetType] = useState("mixed");
  const [currency, setCurrency] = useState("USD");
  const [startingBalance, setStartingBalance] = useState(10000);
  const [accountCreated, setAccountCreated] = useState(false);

  // Step 4 — AI
  const [aiBaseUrl, setAiBaseUrl] = useState(defaultAiBaseUrl);
  const [aiModel, setAiModel] = useState(defaultAiModel);
  const [aiKey, setAiKey] = useState("");
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [aiModels, setAiModels] = useState<string[] | null>(null);
  const [aiScanError, setAiScanError] = useState<string | null>(null);
  const [isScanningAi, startScanningAi] = useTransition();

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const handleCreateAccount = () => {
    setError(null);
    if (!accountName.trim()) return setError("Give your account a name.");
    startTransition(async () => {
      try {
        await createAccount({
          name: accountName,
          assetType,
          currency,
          startingBalance,
        });
        setAccountCreated(true);
        next();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create account");
      }
    });
  };

  const handleTestAi = () => {
    startTransition(async () => {
      await updateAiSettings({ aiBaseUrl, aiApiKey: aiKey, aiModel });
      const result = await testAiConnection();
      setAiTestResult(
        result.ok ? { ok: true, message: result.text } : { ok: false, message: result.error },
      );
    });
  };

  const handleScanAi = () => {
    startScanningAi(async () => {
      setAiScanError(null);
      setAiModels(null);
      await updateAiSettings({ aiBaseUrl, aiApiKey: aiKey, aiModel });
      const result = await listAiModels();
      if (result.ok) {
        setAiModels(result.models);
        if (result.models.length === 0) setAiScanError("Endpoint responded but listed no models.");
      } else {
        setAiScanError(result.error);
      }
    });
  };

  const handleFinish = () => {
    startTransition(async () => {
      if (aiBaseUrl.trim()) {
        await updateAiSettings({ aiBaseUrl, aiApiKey: aiKey, aiModel });
      }
      await markOnboarded();
      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <div className="w-full max-w-xl">
      <div className="mb-8 flex items-center justify-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
                i < step
                  ? "bg-accent text-accent-fg"
                  : i === step
                    ? "border-2 border-accent text-accent"
                    : "border border-border-strong text-text-faint",
              )}
            >
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("h-px w-6", i < step ? "bg-accent" : "bg-border-strong")} />
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface p-8 shadow-2xl shadow-black/20">
        {error && (
          <div className="mb-4 rounded-md border border-loss/40 bg-loss-bg px-3 py-2 text-sm text-loss">
            {error}
          </div>
        )}

        {step === 0 && (
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-accent-fg">
              N
            </div>
            <h1 className="mb-2 text-2xl font-semibold text-text">Welcome to Note My Trades</h1>
            <p className="mx-auto mb-6 max-w-sm text-sm text-text-muted">
              A self-hosted trading journal — no subscription, your data stays on your machine.
              Let&apos;s get you set up in a couple of minutes.
            </p>
            <button
              onClick={next}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg hover:bg-accent-strong"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {step === 1 && (
          <div>
            <StepHeader
              icon={Wallet}
              title="Create your first account"
              subtitle="Trades are logged against an account — this is what your dashboard and reports track. You can add more later."
            />
            <div className="mb-5 grid grid-cols-2 gap-4">
              <Field label="Account Name">
                <input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Asset Type">
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  className={inputClass}
                >
                  {ASSET_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Currency">
                <input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  className={inputClass}
                />
              </Field>
              <Field label="Starting Balance" hint="Powers the dashboard's %-view toggle.">
                <input
                  type="number"
                  step="any"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
            </div>
            <StepNav>
              <BackButton onClick={back} />
              <button
                onClick={handleCreateAccount}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
              >
                {isPending ? "Creating…" : "Create Account"} <ArrowRight className="h-4 w-4" />
              </button>
            </StepNav>
          </div>
        )}

        {step === 2 && (
          <div>
            <StepHeader
              icon={Upload}
              title="Bring in your trades"
              subtitle="Import a CSV from your broker now, or skip and add trades as you go."
            />
            <div className="mb-5 flex flex-col gap-3">
              <Link
                href="/trades/import"
                className="rounded-md border border-border-strong px-4 py-3 text-sm text-text hover:bg-surface-2"
              >
                <div className="font-medium">Import a CSV now</div>
                <div className="text-xs text-text-faint">
                  Opens the import tool in this tab — come back to Settings anytime to keep
                  onboarding later.
                </div>
              </Link>
            </div>
            <StepNav>
              <BackButton onClick={back} />
              <button
                onClick={next}
                className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg hover:bg-accent-strong"
              >
                I&apos;ll do this later <ArrowRight className="h-4 w-4" />
              </button>
            </StepNav>
          </div>
        )}

        {step === 3 && (
          <div>
            <StepHeader
              icon={Sparkles}
              title="Connect AI (optional)"
              subtitle="Point this at your local Omniroute gateway to enable AI Insights, report narratives, and notebook writing assist. Skip this and set it up anytime from Settings."
            />
            <div className="mb-4 grid grid-cols-2 gap-4">
              <Field label="Base URL">
                <input
                  value={aiBaseUrl}
                  onChange={(e) => setAiBaseUrl(e.target.value)}
                  placeholder="http://localhost:4000/v1"
                  className={inputClass}
                />
              </Field>
              <Field label="Model" hint="Usually needs a provider/model prefix, e.g. openai/default.">
                <div className="flex gap-2">
                  <input
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    placeholder="openai/default"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={handleScanAi}
                    disabled={isScanningAi || !aiBaseUrl.trim()}
                    title={!aiBaseUrl.trim() ? "Set a Base URL first" : "Scan the endpoint for available models"}
                    className="flex shrink-0 items-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-sm text-text-muted hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Search className="h-3.5 w-3.5" /> {isScanningAi ? "Scanning…" : "Scan"}
                  </button>
                </div>
                {aiModels && aiModels.length > 0 && (
                  <select
                    value={aiModels.includes(aiModel) ? aiModel : ""}
                    onChange={(e) => e.target.value && setAiModel(e.target.value)}
                    className={`${inputClass} mt-2`}
                  >
                    <option value="" disabled>
                      {aiModels.length} model{aiModels.length === 1 ? "" : "s"} found — select one…
                    </option>
                    {aiModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                )}
                {aiScanError && <p className="mt-1.5 text-xs text-loss">{aiScanError}</p>}
              </Field>
              <Field label="API Key (optional)">
                <input
                  type="password"
                  value={aiKey}
                  onChange={(e) => setAiKey(e.target.value)}
                  placeholder="(none)"
                  className={inputClass}
                />
              </Field>
            </div>
            <button
              onClick={handleTestAi}
              disabled={isPending || !aiBaseUrl.trim()}
              className="mb-4 rounded-md border border-border-strong px-4 py-2 text-sm text-text hover:bg-surface-2 disabled:opacity-50"
            >
              {isPending ? "Testing…" : "Test Connection"}
            </button>
            {aiTestResult && (
              <div
                className={cn(
                  "mb-4 rounded-md border px-3 py-2 text-sm",
                  aiTestResult.ok
                    ? "border-profit/40 bg-profit-bg text-profit"
                    : "border-loss/40 bg-loss-bg text-loss",
                )}
              >
                {aiTestResult.message}
              </div>
            )}
            <StepNav>
              <BackButton onClick={back} />
              <button
                onClick={next}
                className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg hover:bg-accent-strong"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </StepNav>
          </div>
        )}

        {step === 4 && (
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-profit-bg text-profit">
              <Rocket className="h-7 w-7" />
            </div>
            <h1 className="mb-2 text-2xl font-semibold text-text">You&apos;re all set</h1>
            <p className="mx-auto mb-6 max-w-sm text-sm text-text-muted">
              {accountCreated ? `"${accountName}" is ready. ` : ""}Head to your dashboard, or jump
              straight into logging a trade.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={handleFinish}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
              >
                {isPending ? "Finishing…" : "Go to Dashboard"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Wallet;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mb-1 text-xl font-semibold text-text">{title}</h2>
      <p className="text-sm text-text-muted">{subtitle}</p>
    </div>
  );
}

function StepNav({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between">{children}</div>;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md border border-border-strong px-4 py-2.5 text-sm text-text-muted hover:bg-surface-2"
    >
      <ArrowLeft className="h-4 w-4" /> Back
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-text-faint">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent";
