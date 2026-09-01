-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "onboardedAt" DATETIME,
    "aiBaseUrl" TEXT,
    "aiApiKey" TEXT,
    "aiModel" TEXT,
    "updatedAt" DATETIME NOT NULL
);
