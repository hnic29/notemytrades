# Note My Trades

A self-hosted trading journal, backtester, and analytics app. Single-user by
design — there's no login, no multi-tenant data separation, and no
subscription. Your data lives in a local SQLite file under `data/`.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

`npm run build && npm start` runs a production build the same way.

## Network exposure — read this before running it on shared Wi-Fi

`npm run dev` / `npm start` bind to `127.0.0.1` (localhost) only, by
design — the app has no authentication, so anything that can reach it
has full read/write/delete access to your journal, can trigger AI
requests using your saved API key, can export your entire database in
one request, and (if TradingView Desktop sync is configured) can launch
TradingView Desktop on this machine.

If you deliberately want to reach it from another device on your own
network (e.g. a phone on the same Wi-Fi), use:

```bash
npm run dev:lan
# or
npm run start:lan
```

Only do this on a network you trust — anyone else on it gets the same
full access you do. Don't do this on a network you don't control (a
café, a shared office, a hotel), and don't port-forward this app to the
public internet without adding your own authentication in front of it.

## Stack

Next.js (App Router) · Prisma + SQLite · Tailwind. See `AGENTS.md` for
notes on the project's Next.js version quirks.
