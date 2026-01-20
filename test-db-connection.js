const { PrismaClient } = require('@prisma/client');

async function testDatabaseConnection() {
  console.log('Testing database connection...');
  
  const prisma = new PrismaClient({
    log: ['error', 'warn', 'info']
  });
  
  try {
    // Test 1: Basic connection
    console.log('\n1. Testing basic connection...');
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test 2: Check if LoginAttempt table exists
    console.log('\n2. Testing LoginAttempt table...');
    try {
      const count = await prisma.loginAttempt.count();
      console.log('✅ LoginAttempt table exists, current count:', count);
    } catch (error) {
      console.error('❌ LoginAttempt table error:', error.message);
      
      // Check if it's a table doesn't exist error
      if (error.message.includes('does not exist') || error.message.includes('Unknown table')) {
        console.log('⚠️  LoginAttempt table does not exist. You may need to run migrations.');
      }
    }
    
    // Test 3: Check User table
    console.log('\n3. Testing User table...');
    try {
      const userCount = await prisma.user.count();
      console.log('✅ User table exists, current count:', userCount);
    } catch (error) {
      console.error('❌ User table error:', error.message);
    }
    
    // Test 4: Test creating a login attempt
    console.log('\n4. Testing login attempt creation...');
    try {
      const testAttempt = await prisma.loginAttempt.create({
        data: {
          phoneNumber: '2349061775633',
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          success: true
        }
      });
      console.log('✅ Login attempt created successfully:', testAttempt.id);
      
      // Clean up test data
      await prisma.loginAttempt.delete({
        where: { id: testAttempt.id }
      });
      console.log('✅ Test data cleaned up');
      
    } catch (error) {
      console.error('❌ Login attempt creation failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
    console.log('\n✅ Database connection closed');
  }
}

testDatabaseConnection(); 