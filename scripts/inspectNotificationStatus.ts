import { prisma } from "../src/lib/prisma";

async function main() {
  const enumValues = await prisma.$queryRaw<
    { value: string }[]
  >`SELECT unnest(enum_range(NULL::"NotificationStatus"))::text AS value`;

  console.log("NotificationStatus enum values:", enumValues.map(row => row.value));

  const distinctLogStatuses = await prisma.notificationLog.groupBy({
    by: ["status"],
    _count: true,
  }).catch(() => []);

  console.log("Existing NotificationLog statuses:", distinctLogStatuses);
}

main()
  .catch(error => {
    console.error("Failed to inspect notification status enum:", error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
