-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "broker" TEXT,
    "assetType" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "startingBalance" REAL NOT NULL DEFAULT 0,
    "isPropFirm" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'closed',
    "openedAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    "quantity" REAL NOT NULL,
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

-- CreateTable
CREATE TABLE "Execution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "price" REAL NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "isEntry" BOOLEAN NOT NULL,
    CONSTRAINT "Execution_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT
);

-- CreateTable
CREATE TABLE "TradeTag" (
    "tradeId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("tradeId", "tagId"),
    CONSTRAINT "TradeTag_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TradeTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rulesJson" TEXT,
    "shareSlug" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MissedTrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "strategyId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "notes" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MissedTrade_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "folderId" TEXT,
    "fontSize" INTEGER NOT NULL DEFAULT 16,
    "shareSlug" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Note_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NoteTag" (
    "noteId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("noteId", "tagId"),
    CONSTRAINT "NoteTag_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NoteTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NoteTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DailyNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "contentJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Widget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "size" TEXT NOT NULL DEFAULT 'md',
    "config" TEXT
);

-- CreateTable
CREATE TABLE "ProgressRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frequency" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProgressState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "tradeId" TEXT,
    CONSTRAINT "ProgressState_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ProgressRule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PropAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "firmName" TEXT NOT NULL,
    "challengeType" TEXT,
    "phase" TEXT NOT NULL DEFAULT 'challenge',
    "profitTarget" REAL,
    "maxDailyLoss" REAL,
    "maxTotalDrawdown" REAL,
    "accountSize" REAL NOT NULL,
    "startDate" DATETIME,
    CONSTRAINT "PropAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PropTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propAccountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "notes" TEXT,
    CONSTRAINT "PropTransaction_propAccountId_fkey" FOREIGN KEY ("propAccountId") REFERENCES "PropAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PropPayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propAccountId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "requestedAt" DATETIME NOT NULL,
    "paidAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "PropPayout_propAccountId_fkey" FOREIGN KEY ("propAccountId") REFERENCES "PropAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BacktestSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "playbackSpeed" REAL NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "shareSlug" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BacktestSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Trade_shareSlug_key" ON "Trade"("shareSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_noteId_key" ON "Trade"("noteId");

-- CreateIndex
CREATE INDEX "Trade_accountId_idx" ON "Trade"("accountId");

-- CreateIndex
CREATE INDEX "Trade_symbol_idx" ON "Trade"("symbol");

-- CreateIndex
CREATE INDEX "Trade_openedAt_idx" ON "Trade"("openedAt");

-- CreateIndex
CREATE INDEX "Execution_tradeId_idx" ON "Execution"("tradeId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Strategy_shareSlug_key" ON "Strategy"("shareSlug");

-- CreateIndex
CREATE INDEX "MissedTrade_strategyId_idx" ON "MissedTrade"("strategyId");

-- CreateIndex
CREATE UNIQUE INDEX "Note_shareSlug_key" ON "Note"("shareSlug");

-- CreateIndex
CREATE UNIQUE INDEX "DailyNote_date_key" ON "DailyNote"("date");

-- CreateIndex
CREATE INDEX "ProgressState_ruleId_date_idx" ON "ProgressState"("ruleId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PropAccount_accountId_key" ON "PropAccount"("accountId");

-- CreateIndex
CREATE INDEX "PropTransaction_propAccountId_idx" ON "PropTransaction"("propAccountId");

-- CreateIndex
CREATE INDEX "PropPayout_propAccountId_idx" ON "PropPayout"("propAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "BacktestSession_shareSlug_key" ON "BacktestSession"("shareSlug");
