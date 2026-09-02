"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle, Search } from "lucide-react";
import { updateAiSettings, testAiConnection, listAiModels } from "@/lib/actions/settings";

export function AiSettingsForm({
  initialBaseUrl,
  hasApiKey,
  initialModel,
}: {
  initialBaseUrl: string;
  /** Whether a key is currently saved — the real key is never sent to
   * the client, so this is all the form has to go on until the user
   * types a new one. */
  hasApiKey: boolean;
  initialModel: string;
}) {
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl);
  const [apiKey, setApiKey] = useState("");
  const [keySaved, setKeySaved] = useState(hasApiKey);
  const [model, setModel] = useState(initialModel);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [models, setModels] = useState<string[] | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [isScanning, startScanning] = useTransition();
  const [isClearing, startClearing] = useTransition();

  // An empty field means "leave the saved key as-is" (undefined) — the
  // field never holds the real key to begin with, so empty can't mean
  // "the user wants to blank it out." Clearing has its own explicit button.
  const keyForSave = () => (apiKey.trim() === "" ? undefined : apiKey);

  const save = () => {
    startSaving(async () => {
      await updateAiSettings({ aiBaseUrl: baseUrl, aiApiKey: keyForSave(), aiModel: model });
      if (apiKey.trim() !== "") setKeySaved(true);
      setSaved(true);
      setTestResult(null);
      setTimeout(() => setSaved(false), 1500);
    });
  };

  const test = () => {
    startTesting(async () => {
      await updateAiSettings({ aiBaseUrl: baseUrl, aiApiKey: keyForSave(), aiModel: model });
      if (apiKey.trim() !== "") setKeySaved(true);
      const result = await testAiConnection();
      setTestResult(
        result.ok
          ? { ok: true, message: result.text }
          : { ok: false, message: result.error },
      );
    });
  };

  const scan = () => {
    startScanning(async () => {
      setScanError(null);
      setModels(null);
      // Scan against whatever's currently typed, not just what's saved.
      await updateAiSettings({ aiBaseUrl: baseUrl, aiApiKey: keyForSave(), aiModel: model });
      if (apiKey.trim() !== "") setKeySaved(true);
      const result = await listAiModels();
      if (result.ok) {
        setModels(result.models);
        if (result.models.length === 0) {
          setScanError("Endpoint responded but listed no models.");
        }
      } else {
        setScanError(result.error);
      }
    });
  };

  const clearKey = () => {
    startClearing(async () => {
      await updateAiSettings({ aiBaseUrl: baseUrl, aiApiKey: "", aiModel: model });
      setApiKey("");
      setKeySaved(false);
      setTestResult(null);
    });
  };

  return (
    <div className="max-w-xl space-y-4">
      <Field label="Base URL" hint="Your Omniroute gateway's OpenAI-compatible endpoint.">
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="http://localhost:4000/v1"
          className={inputClass}
        />
      </Field>
      <Field
        label="API Key"
        hint={
          keySaved
            ? "A key is saved. Leave this blank to keep it, or type a new one to replace it."
            : "Leave blank if your gateway doesn't require auth."
        }
      >
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={keySaved ? "•••••••• (saved — leave blank to keep)" : "(none)"}
            className={inputClass}
          />
          {keySaved && (
            <button
              type="button"
              onClick={clearKey}
              disabled={isClearing}
              className="shrink-0 rounded-md border border-border-strong px-3 py-2 text-sm text-text-muted hover:bg-surface-2 disabled:opacity-50"
            >
              {isClearing ? "Clearing…" : "Clear"}
            </button>
          )}
        </div>
      </Field>
      <Field
        label="Model"
        hint="Most gateways (including Omniroute) need a provider/model prefix, not just a bare name — e.g. openai/default or openai/gpt-4o-mini, matching however it's configured."
      >
        <div className="flex gap-2">
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="openai/default"
            className={inputClass}
          />
          <button
            type="button"
            onClick={scan}
            disabled={isScanning || !baseUrl.trim()}
            title={!baseUrl.trim() ? "Set a Base URL first" : "Scan the endpoint for available models"}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-sm text-text-muted hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Search className="h-3.5 w-3.5" /> {isScanning ? "Scanning…" : "Scan"}
          </button>
        </div>

        {models && models.length > 0 && (
          <select
            value={models.includes(model) ? model : ""}
            onChange={(e) => e.target.value && setModel(e.target.value)}
            className={`${inputClass} mt-2`}
          >
            <option value="" disabled>
              {models.length} model{models.length === 1 ? "" : "s"} found — select one…
            </option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}

        {scanError && <p className="mt-1.5 text-xs text-loss">{scanError}</p>}
      </Field>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={isSaving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
        >
          {isSaving ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
        <button
          onClick={test}
          disabled={isTesting}
          className="rounded-md border border-border-strong px-4 py-2 text-sm text-text hover:bg-surface-2 disabled:opacity-50"
        >
          {isTesting ? "Testing…" : "Save & Test Connection"}
        </button>
      </div>

      {testResult && (
        <div
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
            testResult.ok
              ? "border-profit/40 bg-profit-bg text-profit"
              : "border-loss/40 bg-loss-bg text-loss"
          }`}
        >
          {testResult.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{testResult.message}</span>
        </div>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent";

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
