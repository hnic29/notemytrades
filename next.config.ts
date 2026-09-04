import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

/**
 * Next.js's dev server blocks cross-origin requests to dev-only
 * resources (notably the HMR websocket) unless the origin is
 * allowlisted — without this, loading the dashboard from another
 * device over LAN silently breaks Fast Refresh's client runtime,
 * which in turn breaks anything relying on it at mount time (recharts'
 * ResponsiveContainer measures via a ResizeObserver on mount, so the
 * equity curve/drawdown/trade-score charts render blank instead of
 * throwing something visible). Computed from the machine's actual
 * interfaces at startup instead of a hardcoded IP, so switching
 * networks or getting a new DHCP lease doesn't silently break this
 * again — see `npm run dev:lan`.
 */
function lanDevOrigins(): string[] {
  const origins: string[] = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) origins.push(addr.address);
    }
  }
  return origins;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: lanDevOrigins(),
};

export default nextConfig;
