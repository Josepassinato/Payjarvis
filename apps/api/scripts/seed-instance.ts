/**
 * Seed the first OpenClaw instance in the database.
 * Run: npx tsx apps/api/scripts/seed-instance.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Check if instance already exists
  const existing = await prisma.openClawInstance.findFirst({
    where: { name: "instance-01" },
  });

  if (existing) {
    console.log(`Instance already exists: ${existing.name} (${existing.id}), port ${existing.port}, status ${existing.status}`);
    return;
  }

  const instance = await prisma.openClawInstance.create({
    data: {
      name: "instance-01",
      processName: "openclaw",
      port: 4000, // logical port (OpenClaw is polling-based, but port reserved for future HTTP API)
      capacity: 100,
      currentLoad: 0,
      status: "ACTIVE",
    },
  });

  console.log(`Created instance: ${instance.name} (${instance.id})`);
  console.log(`  PM2 process: ${instance.processName}`);
  console.log(`  Port: ${instance.port}`);
  console.log(`  Capacity: ${instance.capacity}`);
  console.log(`  Status: ${instance.status}`);

  // Assign existing ACTIVE users to this instance
  const activeUsers = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, email: true },
  });

  if (activeUsers.length > 0) {
    for (const user of activeUsers) {
      const alreadyAssigned = await prisma.instanceUser.findUnique({
        where: { userId: user.id },
      });
      if (!alreadyAssigned) {
        await prisma.instanceUser.create({
          data: { userId: user.id, instanceId: instance.id },
        });
        console.log(`  Assigned user ${user.email} to ${instance.name}`);
      }
    }

    // Update load count
    const assignedCount = await prisma.instanceUser.count({
      where: { instanceId: instance.id },
    });
    await prisma.openClawInstance.update({
      where: { id: instance.id },
      data: { currentLoad: assignedCount },
    });
    console.log(`  Total load: ${assignedCount}/${instance.capacity}`);
  } else {
    console.log("  No active users to assign.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
