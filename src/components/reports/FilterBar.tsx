"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { hasActiveFilters, parseFilters } from "@/lib/filters";

type Option = { value: string; label: string };

export function FilterBar({
  accounts,
  tags,
}: {
  accounts: Option[];
  tags: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = parseFilters(Object.fromEntries(searchParams.entries()));

  const update = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  };

  const clear = () => router.push(pathname);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-3">
      <input
        type="date"
        value={filters.from ?? ""}
        onChange={(e) => update({ from: e.target.value || undefined })}
        className={inputClass}
      />
      <span className="text-text-faint">to</span>
      <input
        type="date"
        value={filters.to ?? ""}
        onChange={(e) => update({ to: e.target.value || undefined })}
        className={inputClass}
      />

      <select
        value={filters.accountId ?? ""}
        onChange={(e) => update({ accountId: e.target.value || undefined })}
        className={inputClass}
      >
        <option value="">All Accounts</option>
        {accounts.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Symbol"
        defaultValue={filters.symbol ?? ""}
        onBlur={(e) => update({ symbol: e.target.value || undefined })}
        onKeyDown={(e) => {
          if (e.key === "Enter") update({ symbol: (e.target as HTMLInputElement).value || undefined });
        }}
        className={`${inputClass} w-24`}
      />

      <select
        value={filters.side ?? ""}
        onChange={(e) => update({ side: e.target.value || undefined })}
        className={inputClass}
      >
        <option value="">Long &amp; Short</option>
        <option value="long">Long</option>
        <option value="short">Short</option>
      </select>

      {tags.length > 0 && (
        <select
          value={filters.tag ?? ""}
          onChange={(e) => update({ tag: e.target.value || undefined })}
          className={inputClass}
        >
          <option value="">All Tags</option>
          {tags.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      )}

      {hasActiveFilters(filters) && (
        <button
          onClick={clear}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-text-faint hover:text-text"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}
    </div>
  );
}

const inputClass =
  "rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent";
