import { prisma } from "@/lib/prisma";

async function main() {
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: { onboardedAt: new Date() },
    create: { id: "singleton", onboardedAt: new Date() },
  });

  const hasAccount = await prisma.account.findFirst();
  if (!hasAccount) {
    await prisma.account.create({
      data: { name: "Main Account", assetType: "mixed", currency: "USD" },
    });
  }
}

main().then(() => process.exit(0));
