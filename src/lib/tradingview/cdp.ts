import { SNAPSHOT_SCRIPT, type SnapshotResult, type TradingViewSnapshot } from "./snapshot";

/**
 * Talks to a TradingView Desktop started with
 * `--remote-debugging-port=<port>` over the Chrome DevTools Protocol:
 * list its pages, pick the chart, evaluate the snapshot script in it.
 * Node's built-in WebSocket is enough — one request, one reply.
 */

export const DEFAULT_CDP_PORT = 9222;

export type TradingViewSyncErrorCode =
  | "unreachable"
  | "no-chart"
  | "no-api"
  | "no-broker"
  | "not-connected"
  | "unsupported-broker"
  | "protocol";

export class TradingViewSyncError extends Error {
  constructor(
    public readonly code: TradingViewSyncErrorCode,
    message: string,
    /** What the user can do about it. */
    public readonly hint: string,
  ) {
    super(message);
    this.name = "TradingViewSyncError";
  }
}

export type CdpTarget = { id: string; type: string; url: string; title?: string; webSocketDebuggerUrl?: string };

/** The chart page, if TradingView has one open. Its other targets are workers, devtools, extensions. */
export function pickChartTarget(targets: CdpTarget[]): CdpTarget | null {
  const pages = targets.filter((t) => t.type === "page" && t.webSocketDebuggerUrl);
  return (
    pages.find((t) => /tradingview\.com\/chart/i.test(t.url)) ??
    pages.find((t) => /tradingview\.com/i.test(t.url)) ??
    null
  );
}

export function launchHint(port: number = DEFAULT_CDP_PORT) {
  return (
    "TradingView Desktop has to be started with remote debugging on. Quit it completely (the tray icon too), then use Launch TradingView here — or from PowerShell: " +
    `Start-Process "$((Get-AppxPackage TradingView.Desktop).InstallLocation)\\TradingView.exe" -ArgumentList "--remote-debugging-port=${port}"`
  );
}

export async function listTargets(port: number, timeoutMs = 3000): Promise<CdpTarget[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as CdpTarget[];
  } catch {
    throw new TradingViewSyncError(
      "unreachable",
      `TradingView isn't reachable on port ${port}.`,
      launchHint(port),
    );
  } finally {
    clearTimeout(timer);
  }
}

/** One CDP Runtime.evaluate round trip on a fresh socket. */
export async function evaluateInTarget<T>(wsUrl: string, expression: string, timeoutMs = 60_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        // already closed
      }
      fn();
    };
    const timer = setTimeout(
      () =>
        finish(() =>
          reject(
            new TradingViewSyncError(
              "protocol",
              "TradingView didn't answer in time.",
              "Make sure the chart has finished loading and the Trading Panel shows Paper Trading connected, then try again.",
            ),
          ),
        ),
      timeoutMs,
    );

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { expression, awaitPromise: true, returnByValue: true },
        }),
      );
    };
    ws.onmessage = (event) => {
      let msg: {
        id?: number;
        result?: { result?: { value?: unknown }; exceptionDetails?: { text?: string; exception?: { description?: string } } };
        error?: { message?: string };
      };
      try {
        msg = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (msg.id !== 1) return;
      if (msg.error) {
        return finish(() =>
          reject(new TradingViewSyncError("protocol", msg.error?.message ?? "DevTools protocol error", "Try again.")),
        );
      }
      const details = msg.result?.exceptionDetails;
      if (details) {
        const text = details.exception?.description ?? details.text ?? "Script failed inside TradingView";
        return finish(() =>
          reject(
            new TradingViewSyncError(
              "protocol",
              text.split("\n")[0],
              "TradingView may have changed its internals. Export the CSV files instead and import those.",
            ),
          ),
        );
      }
      finish(() => resolve(msg.result?.result?.value as T));
    };
    ws.onerror = () =>
      finish(() =>
        reject(
          new TradingViewSyncError(
            "unreachable",
            "Lost the connection to TradingView.",
            "Only one DevTools client can talk to a page at a time — close other tools attached to TradingView and try again.",
          ),
        ),
      );
    ws.onclose = () =>
      finish(() => reject(new TradingViewSyncError("protocol", "TradingView closed the connection.", "Try again.")));
  });
}

/** Everything the sync needs, read from the live chart in one go. */
export async function fetchTradingViewSnapshot(port = DEFAULT_CDP_PORT): Promise<TradingViewSnapshot> {
  const targets = await listTargets(port);
  const target = pickChartTarget(targets);
  if (!target?.webSocketDebuggerUrl) {
    throw new TradingViewSyncError(
      "no-chart",
      "TradingView is running but no chart is open.",
      "Open a chart in TradingView (any symbol) and try again.",
    );
  }

  const result = await evaluateInTarget<SnapshotResult | undefined>(target.webSocketDebuggerUrl, SNAPSHOT_SCRIPT);
  if (!result) {
    throw new TradingViewSyncError("protocol", "TradingView returned nothing.", "Wait for the chart to load and try again.");
  }
  if (result.ok) return result;

  switch (result.code) {
    case "no-api":
      throw new TradingViewSyncError(
        "no-api",
        "The chart page hasn't exposed its trading API yet.",
        "Wait for the chart to finish loading and try again.",
      );
    case "no-broker":
      throw new TradingViewSyncError(
        "no-broker",
        "No broker is active in TradingView's Trading Panel.",
        "Open the Trading Panel at the bottom of the chart and connect Paper Trading.",
      );
    case "not-connected":
      throw new TradingViewSyncError(
        "not-connected",
        `${result.broker?.title ?? "The broker"} isn't connected in TradingView's Trading Panel.`,
        "Open the Trading Panel at the bottom of the chart and connect Paper Trading.",
      );
    case "unsupported-broker":
      throw new TradingViewSyncError(
        "unsupported-broker",
        `TradingView is connected to ${result.broker?.title ?? "another broker"}, not Paper Trading.`,
        "Only Paper Trading can be synced. Switch the Trading Panel to Paper Trading, or import that broker's own export instead.",
      );
  }
}
