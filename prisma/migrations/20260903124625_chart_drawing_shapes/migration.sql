-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChartDrawing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "time1" INTEGER,
    "price1" REAL,
    "time2" INTEGER,
    "price2" REAL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChartDrawing_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BacktestSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ChartDrawing" ("createdAt", "id", "price1", "price2", "sessionId", "time1", "time2", "type") SELECT "createdAt", "id", "price1", "price2", "sessionId", "time1", "time2", "type" FROM "ChartDrawing";
DROP TABLE "ChartDrawing";
ALTER TABLE "new_ChartDrawing" RENAME TO "ChartDrawing";
CREATE INDEX "ChartDrawing_sessionId_idx" ON "ChartDrawing"("sessionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
