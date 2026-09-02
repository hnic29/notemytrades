"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createAccount,
  deleteAccount,
  setAccountArchived,
  updateAccount,
} from "@/lib/actions/accounts";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type Account = {
  id: string;
  name: string;
  broker: string | null;
  assetType: string | null;
  currency: string;
  startingBalance: number;
  archived: boolean;
  isPropFirm: boolean;
};

const ASSET_TYPES = ["mixed", "stock", "futures", "forex", "crypto", "option"];

type Draft = {
  name: string;
  broker: string;
  assetType: string;
  currency: string;
  startingBalance: number;
};

const emptyDraft: Draft = {
  name: "",
  broker: "",
  assetType: "mixed",
  currency: "USD",
  startingBalance: 0,
};

export function AccountsManager({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const startEdit = (a: Account) => {
    setError(null);
    setEditingId(a.id);
    setDraft({
      name: a.name,
      broker: a.broker ?? "",
      assetType: a.assetType ?? "mixed",
      currency: a.currency,
      startingBalance: a.startingBalance,
    });
  };

  const saveEdit = (id: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await updateAccount(id, draft);
        setEditingId(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save account");
      }
    });
  };

  const saveNew = () => {
    if (!draft.name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createAccount(draft);
        setCreating(false);
        setDraft(emptyDraft);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create account");
      }
    });
  };

  return (
    <div className="space-y-3">
      {accounts.map((a) =>
        editingId === a.id ? (
          <AccountFormRow
            key={a.id}
            draft={draft}
            setDraft={setDraft}
            onCancel={() => {
              setEditingId(null);
              setError(null);
            }}
            onSave={() => saveEdit(a.id)}
            saving={isPending}
            saveLabel="Save"
            error={error}
          />
        ) : (
          <div
            key={a.id}
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-3",
              a.archived && "opacity-50",
            )}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-text">{a.name}</span>
                {a.isPropFirm && (
                  <span className="rounded-full border border-border-strong px-1.5 py-0.5 text-[10px] text-text-faint">
                    prop
                  </span>
                )}
                {a.archived && (
                  <span className="rounded-full border border-border-strong px-1.5 py-0.5 text-[10px] text-text-faint">
                    archived
                  </span>
                )}
              </div>
              <p className="text-xs text-text-faint">
                {a.broker || "no broker set"} · {a.assetType} · {a.currency} · starting balance{" "}
                {formatCurrency(a.startingBalance, a.currency)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => startEdit(a)}
                className="rounded p-1.5 text-text-faint hover:bg-surface-2 hover:text-text"
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() =>
                  startTransition(async () => {
                    await setAccountArchived(a.id, !a.archived);
                    router.refresh();
                  })
                }
                className="rounded p-1.5 text-text-faint hover:bg-surface-2 hover:text-text"
                title={a.archived ? "Unarchive" : "Archive"}
              >
                {a.archived ? (
                  <ArchiveRestore className="h-3.5 w-3.5" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={() => {
                  if (!window.confirm(`Delete "${a.name}"? This also deletes its trades.`)) return;
                  startTransition(async () => {
                    await deleteAccount(a.id);
                    router.refresh();
                  });
                }}
                className="rounded p-1.5 text-text-faint hover:bg-loss-bg hover:text-loss"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ),
      )}

      {creating ? (
        <AccountFormRow
          draft={draft}
          setDraft={setDraft}
          onCancel={() => {
            setCreating(false);
            setDraft(emptyDraft);
            setError(null);
          }}
          onSave={saveNew}
          saving={isPending}
          saveLabel="Add Account"
          error={error}
        />
      ) : (
        <button
          onClick={() => {
            setCreating(true);
            setDraft(emptyDraft);
          }}
          className="flex items-center gap-1.5 text-sm text-text-faint hover:text-accent"
        >
          <Plus className="h-3.5 w-3.5" /> Add account
        </button>
      )}
    </div>
  );
}

function AccountFormRow({
  draft,
  setDraft,
  onCancel,
  onSave,
  saving,
  saveLabel,
  error,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  saveLabel: string;
  error?: string | null;
}) {
  return (
    <div className="space-y-2 rounded-md border border-accent/40 bg-surface p-3">
      {error && (
        <div className="rounded-md border border-loss/40 bg-loss-bg px-3 py-2 text-sm text-loss">{error}</div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Account name"
          className={inputClass}
        />
        <input
          value={draft.broker}
          onChange={(e) => setDraft({ ...draft, broker: e.target.value })}
          placeholder="Broker (optional)"
          className={inputClass}
        />
        <select
          value={draft.assetType}
          onChange={(e) => setDraft({ ...draft, assetType: e.target.value })}
          className={inputClass}
        >
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          value={draft.currency}
          onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })}
          placeholder="USD"
          className={inputClass}
        />
        <input
          type="number"
          step="any"
          value={draft.startingBalance}
          onChange={(e) => setDraft({ ...draft, startingBalance: Number(e.target.value) })}
          placeholder="Starting balance"
          className={inputClass}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg hover:bg-accent-strong disabled:opacity-50"
        >
          {saveLabel}
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-border-strong px-3 py-1.5 text-sm text-text-muted hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent";
