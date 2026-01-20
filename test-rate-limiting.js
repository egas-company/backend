// Simple test script to verify rate limiting logic
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testRateLimiting() {
  const phoneNumber = '+2347034528526';
  const ipAddress = '192.168.1.1';
  
  console.log('Testing rate limiting logic...\n');
  
  // Clear any existing test data
  await prisma.loginAttempt.deleteMany({
    where: {
      phoneNumber: phoneNumber
    }
  });
  
  // Test 1: Check initial state
  console.log('Test 1: Initial state');
  const initialAttempts = await prisma.loginAttempt.count({
    where: {
      phoneNumber: phoneNumber,
      success: false,
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
        lt: new Date(new Date().setDate(new Date().getDate() + 1))
      }
    }
  });
  console.log(`Initial failed attempts: ${initialAttempts}`);
  console.log(`Remaining attempts: ${4 - initialAttempts}\n`);
  
  // Test 2: Add 3 failed attempts
  console.log('Test 2: Adding 3 failed attempts');
  for (let i = 0; i < 3; i++) {
    await prisma.loginAttempt.create({
      data: {
        phoneNumber: phoneNumber,
        ipAddress: ipAddress,
        userAgent: 'Test User Agent',
        success: false
      }
    });
  }
  
  const attemptsAfter3 = await prisma.loginAttempt.count({
    where: {
      phoneNumber: phoneNumber,
      success: false,
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
        lt: new Date(new Date().setDate(new Date().getDate() + 1))
      }
    }
  });
  console.log(`Failed attempts after 3: ${attemptsAfter3}`);
  console.log(`Remaining attempts: ${4 - attemptsAfter3}\n`);
  
  // Test 3: Add 4th failed attempt (should hit limit)
  console.log('Test 3: Adding 4th failed attempt (should hit limit)');
  await prisma.loginAttempt.create({
    data: {
      phoneNumber: phoneNumber,
      ipAddress: ipAddress,
      userAgent: 'Test User Agent',
      success: false
    }
  });
  
  const attemptsAfter4 = await prisma.loginAttempt.count({
    where: {
      phoneNumber: phoneNumber,
      success: false,
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
        lt: new Date(new Date().setDate(new Date().getDate() + 1))
      }
    }
  });
  console.log(`Failed attempts after 4: ${attemptsAfter4}`);
  console.log(`Remaining attempts: ${4 - attemptsAfter4}`);
  console.log(`Limit exceeded: ${attemptsAfter4 >= 4}\n`);
  
  // Test 4: Add successful attempt
  console.log('Test 4: Adding successful attempt');
  await prisma.loginAttempt.create({
    data: {
      phoneNumber: phoneNumber,
      ipAddress: ipAddress,
      userAgent: 'Test User Agent',
      success: true
    }
  });
  
  const successfulAttempts = await prisma.loginAttempt.count({
    where: {
      phoneNumber: phoneNumber,
      success: true,
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
        lt: new Date(new Date().setDate(new Date().getDate() + 1))
      }
    }
  });
  console.log(`Successful attempts: ${successfulAttempts}\n`);
  
  // Test 5: Show all attempts for today
  console.log('Test 5: All attempts for today');
  const allAttempts = await prisma.loginAttempt.findMany({
    where: {
      phoneNumber: phoneNumber,
      createdAt: {
        gte: new Date(new Date().setHours(0, 0, 0, 0)),
        lt: new Date(new Date().setDate(new Date().getDate() + 1))
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });
  
  allAttempts.forEach((attempt, index) => {
    console.log(`${index + 1}. ${attempt.success ? 'SUCCESS' : 'FAILED'} - ${attempt.createdAt.toISOString()}`);
  });
  
  console.log('\nRate limiting test completed!');
}

testRateLimiting()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  }); 