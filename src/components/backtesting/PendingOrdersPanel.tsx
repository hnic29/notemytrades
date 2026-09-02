"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { formatCurrency } from "@/lib/format";

type PendingOrder = {
  id: string;
  symbol: string;
  side: string;
  orderType: string;
  triggerPrice: number;
  quantity: number;
};

export function PendingOrdersPanel({
  orders,
  onCancel,
}: {
  orders: PendingOrder[];
  onCancel: (orderId: string) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  if (orders.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-surface p-3">
      <h3 className="mb-2 text-xs font-medium text-text-muted">
        Pending Orders ({orders.length})
      </h3>
      <div className="space-y-1.5">
        {orders.map((o) => (
          <div
            key={o.id}
            className="flex items-center justify-between rounded-md bg-surface-2 px-2.5 py-1.5 text-sm"
          >
            <span className="capitalize text-text">
              {o.side} {o.quantity} {o.symbol} · {o.orderType} @ {formatCurrency(o.triggerPrice)}
            </span>
            <button
              disabled={isPending}
              onClick={() => startTransition(() => onCancel(o.id))}
              className="text-text-faint hover:text-loss disabled:opacity-50"
              title="Cancel order"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
