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

// --- USER NOTIFICATION INSPECTION ---
const userId = process.argv[2] || "cmkx2zr2l000yuzcc880ihczf";

async function inspectUserNotificationStatus() {
  console.log(`\nInspecting notification status for userId: ${userId}`);

  // Check NotificationDevice table
  const devices = await prisma.notificationDevice.findMany({
    where: {
      userId,
      enabled: true,
    },
    select: {
      id: true,
      token: true,
      platform: true,
      app: true,
      enabled: true,
      lastSeenAt: true,
    },
  });

  // Check User table
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      pushToken: true,
      fcmToken: true,
      deviceType: true,
      appType: true,
      lastTokenUpdate: true,
    },
  });

  console.log("\nNotificationDevice entries:");
  if (devices.length === 0) {
    console.log("No enabled notification devices found for this user.");
  } else {
    devices.forEach((device, idx) => {
      console.log(`Device ${idx + 1}:`, device);
    });
  }

  console.log("\nUser table notification fields:");
  if (!user) {
    console.log("User not found.");
  } else {
    console.log(user);
  }
}

main()
  .then(inspectUserNotificationStatus)
  .catch(error => {
    console.error("Failed to inspect notification status enum or user notification status:", error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
