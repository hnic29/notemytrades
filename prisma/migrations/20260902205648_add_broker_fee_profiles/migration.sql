-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN "selectedBrokerProfileId" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "taxSetAsidePct" REAL;

-- CreateTable
CREATE TABLE "BrokerFeeProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "perContractFeeFutures" REAL,
    "perContractFeeOptions" REAL,
    "perShareFeeStock" REAL,
    "minFeePerOrder" REAL,
    "monthlyPlatformFee" REAL,
    "sourceUrl" TEXT,
    "feesAsOf" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BrokerFeeProfile_name_key" ON "BrokerFeeProfile"("name");
