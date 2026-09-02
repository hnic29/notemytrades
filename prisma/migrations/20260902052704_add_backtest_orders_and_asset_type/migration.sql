-- AlterTable
ALTER TABLE "Trade" ADD COLUMN "autoBreakevenR" REAL;

-- CreateTable
CREATE TABLE "BacktestOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "triggerPrice" REAL NOT NULL,
    "quantity" REAL NOT NULL,
    "stopLoss" REAL,
    "profitTarget" REAL,
    "autoBreakevenR" REAL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filledTradeId" TEXT,
    CONSTRAINT "BacktestOrder_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BacktestSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BacktestOrder_filledTradeId_fkey" FOREIGN KEY ("filledTradeId") REFERENCES "Trade" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BacktestSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetType" TEXT NOT NULL DEFAULT 'stock',
    "timeframe" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "playbackSpeed" REAL NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "shareSlug" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BacktestSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BacktestSession" ("accountId", "createdAt", "endDate", "id", "name", "playbackSpeed", "shareSlug", "startDate", "status", "symbol", "timeframe") SELECT "accountId", "createdAt", "endDate", "id", "name", "playbackSpeed", "shareSlug", "startDate", "status", "symbol", "timeframe" FROM "BacktestSession";
DROP TABLE "BacktestSession";
ALTER TABLE "new_BacktestSession" RENAME TO "BacktestSession";
CREATE UNIQUE INDEX "BacktestSession_shareSlug_key" ON "BacktestSession"("shareSlug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BacktestOrder_filledTradeId_key" ON "BacktestOrder"("filledTradeId");

-- CreateIndex
CREATE INDEX "BacktestOrder_sessionId_idx" ON "BacktestOrder"("sessionId");
