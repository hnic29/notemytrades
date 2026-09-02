-- CreateTable
CREATE TABLE "ChartDrawing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "time1" INTEGER,
    "price1" REAL NOT NULL,
    "time2" INTEGER,
    "price2" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChartDrawing_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BacktestSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ChartDrawing_sessionId_idx" ON "ChartDrawing"("sessionId");
