import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { listTargets, TradingViewSyncError } from "./cdp";

const execFileAsync = promisify(execFile);

/**
 * Starts TradingView Desktop with remote debugging on, which is the
 * one thing the user would otherwise have to do by hand every time.
 * Windows only — that's where TradingView Desktop's Store build lives;
 * on other platforms the sync still works against a manually launched
 * instance.
 */

async function powershell(command: string, timeoutMs = 15_000): Promise<string> {
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command],
    { timeout: timeoutMs, windowsHide: true },
  );
  return stdout.trim();
}

/** The installed TradingView.exe — Microsoft Store (MSIX) build first, then the classic installer. */
export async function findTradingViewExe(): Promise<string | null> {
  if (process.platform !== "win32") return null;
  try {
    const location = await powershell(
      "(Get-AppxPackage -Name TradingView.Desktop -ErrorAction SilentlyContinue | Select-Object -First 1).InstallLocation",
    );
    if (location) {
      const exe = path.join(location, "TradingView.exe");
      if (fs.existsSync(exe)) return exe;
    }
  } catch {
    // Get-AppxPackage unavailable — fall through to the classic paths
  }
  const candidates = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", "TradingView", "TradingView.exe"),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "TradingView", "TradingView.exe"),
  ].filter((p): p is string => !!p);
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

export async function isTradingViewRunning(): Promise<boolean> {
  if (process.platform !== "win32") return false;
  try {
    const out = await powershell("(Get-Process -Name TradingView -ErrorAction SilentlyContinue | Measure-Object).Count");
    return Number(out) > 0;
  } catch {
    return false;
  }
}

async function isReachable(port: number): Promise<boolean> {
  try {
    await listTargets(port, 1500);
    return true;
  } catch {
    return false;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Launches TradingView with `--remote-debugging-port=<port>` and waits
 * for the port to answer. Electron apps are single-instance: if
 * TradingView is already running without the flag, a second launch
 * just focuses the first one, so that case is reported instead.
 */
export async function launchTradingView(port: number): Promise<{ alreadyRunning: boolean }> {
  if (await isReachable(port)) return { alreadyRunning: true };

  if (process.platform !== "win32") {
    throw new TradingViewSyncError(
      "unreachable",
      "Launching TradingView from here only works on Windows.",
      `Start TradingView Desktop yourself with --remote-debugging-port=${port}, then sync.`,
    );
  }
  if (await isTradingViewRunning()) {
    throw new TradingViewSyncError(
      "unreachable",
      "TradingView is already running, but without remote debugging.",
      "Quit it completely — right-click its tray icon and choose Quit — then click Launch TradingView again.",
    );
  }
  const exe = await findTradingViewExe();
  if (!exe) {
    throw new TradingViewSyncError(
      "unreachable",
      "Couldn't find TradingView Desktop on this PC.",
      `Install it from the Microsoft Store, or start it yourself with --remote-debugging-port=${port}.`,
    );
  }

  await powershell(`Start-Process -FilePath '${exe.replace(/'/g, "''")}' -ArgumentList '--remote-debugging-port=${port}'`);

  // The window comes up within a few seconds; the chart page a few more.
  for (let waited = 0; waited < 45_000; waited += 1000) {
    await sleep(1000);
    if (await isReachable(port)) return { alreadyRunning: false };
  }
  throw new TradingViewSyncError(
    "unreachable",
    "TradingView started but never opened its debugging port.",
    `Check that nothing else is using port ${port}, or change the port in Settings.`,
  );
}
