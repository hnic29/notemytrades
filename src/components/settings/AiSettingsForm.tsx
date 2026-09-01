"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { updateAiSettings, testAiConnection } from "@/lib/actions/settings";

export function AiSettingsForm({
  initialBaseUrl,
  initialApiKey,
  initialModel,
}: {
  initialBaseUrl: string;
  initialApiKey: string;
  initialModel: string;
}) {
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl);
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [model, setModel] = useState(initialModel);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isTesting, startTesting] = useTransition();

  const save = () => {
    startSaving(async () => {
      await updateAiSettings({ aiBaseUrl: baseUrl, aiApiKey: apiKey, aiModel: model });
      setSaved(true);
      setTestResult(null);
      setTimeout(() => setSaved(false), 1500);
    });
  };

  const test = () => {
    startTesting(async () => {
      await updateAiSettings({ aiBaseUrl: baseUrl, aiApiKey: apiKey, aiModel: model });
      const result = await testAiConnection();
      setTestResult(
        result.ok
          ? { ok: true, message: result.text }
          : { ok: false, message: result.error },
      );
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
      <Field label="API Key" hint="Leave blank if your gateway doesn't require auth.">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="(none)"
          className={inputClass}
        />
      </Field>
      <Field
        label="Model"
        hint="Most gateways (including Omniroute) need a provider/model prefix, not just a bare name — e.g. openai/default or openai/gpt-4o-mini, matching however it's configured."
      >
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="openai/default"
          className={inputClass}
        />
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
