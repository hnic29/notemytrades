-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'closed',
    "openedAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    "quantity" REAL NOT NULL,
    "multiplier" REAL NOT NULL DEFAULT 1,
    "avgEntryPrice" REAL NOT NULL,
    "avgExitPrice" REAL,
    "grossPnl" REAL NOT NULL DEFAULT 0,
    "fees" REAL NOT NULL DEFAULT 0,
    "commissions" REAL NOT NULL DEFAULT 0,
    "netPnl" REAL NOT NULL DEFAULT 0,
    "netRoi" REAL,
    "stopLoss" REAL,
    "profitTarget" REAL,
    "quickNote" TEXT,
    "source" TEXT,
    "isBacktest" BOOLEAN NOT NULL DEFAULT false,
    "shareSlug" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "strategyId" TEXT,
    "noteId" TEXT,
    "backtestSessionId" TEXT,
    CONSTRAINT "Trade_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Trade_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Trade_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Trade_backtestSessionId_fkey" FOREIGN KEY ("backtestSessionId") REFERENCES "BacktestSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Trade" ("accountId", "assetType", "avgEntryPrice", "avgExitPrice", "backtestSessionId", "closedAt", "commissions", "createdAt", "fees", "grossPnl", "id", "isBacktest", "netPnl", "netRoi", "noteId", "openedAt", "profitTarget", "quantity", "quickNote", "shareSlug", "side", "source", "status", "stopLoss", "strategyId", "symbol", "updatedAt") SELECT "accountId", "assetType", "avgEntryPrice", "avgExitPrice", "backtestSessionId", "closedAt", "commissions", "createdAt", "fees", "grossPnl", "id", "isBacktest", "netPnl", "netRoi", "noteId", "openedAt", "profitTarget", "quantity", "quickNote", "shareSlug", "side", "source", "status", "stopLoss", "strategyId", "symbol", "updatedAt" FROM "Trade";
DROP TABLE "Trade";
ALTER TABLE "new_Trade" RENAME TO "Trade";
CREATE UNIQUE INDEX "Trade_shareSlug_key" ON "Trade"("shareSlug");
CREATE UNIQUE INDEX "Trade_noteId_key" ON "Trade"("noteId");
CREATE INDEX "Trade_accountId_idx" ON "Trade"("accountId");
CREATE INDEX "Trade_symbol_idx" ON "Trade"("symbol");
CREATE INDEX "Trade_openedAt_idx" ON "Trade"("openedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
