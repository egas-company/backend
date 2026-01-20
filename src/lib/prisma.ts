import { PrismaClient } from "@prisma/client";

const prismaGlobal = global as typeof global & {
  prisma?: PrismaClient;
};

let prisma: PrismaClient;

try {
  // Check if DATABASE_URL is available
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    throw new Error('DATABASE_URL is required');
  }

  prisma = prismaGlobal.prisma ||
    new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn", "info"] : ["error"],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

  // Test the connection
  prisma.$connect()
    .then(() => {
      console.log('✅ Prisma client connected successfully');
    })
    .catch((error) => {
      console.error('❌ Prisma client connection failed:', error);
    });

  if (process.env.NODE_ENV !== "production") {
    prismaGlobal.prisma = prisma;
  }
} catch (error) {
  console.error('❌ Failed to initialize Prisma client:', error);
  
  // Create a fallback client that will throw meaningful errors
  prisma = new PrismaClient({
    log: ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL || 'postgresql://fallback',
      },
    },
  });
}

export { prisma };
