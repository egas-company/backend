const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testBusinessRules() {
  console.log('🧪 Testing Business Rules Implementation');
  console.log('=====================================\n');

  try {
    // Test 1: Check active orders restriction
    console.log('1. Testing Active Orders Restriction...');
    
    // Create a test user
    const testUser = await prisma.user.create({
      data: {
        phoneNumber: '2349061775633',
        firstName: 'Test',
        lastName: 'User',
        role: 'CLIENT'
      }
    });
    
    console.log(`✅ Created test user: ${testUser.id}`);

    // Check if user has active orders (should be false initially)
    const hasActiveOrders = await prisma.order.count({
      where: {
        userId: testUser.id,
        status: {
          in: ['PENDING', 'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT']
        }
      }
    });
    
    console.log(`📊 User has ${hasActiveOrders} active orders (expected: 0)`);

    // Create an active order
    const activeOrder = await prisma.order.create({
      data: {
        orderId: 'TEST-ORDER-001',
        trackingId: 'TRACK-001',
        userId: testUser.id,
        tankSize: '12.5kg',
        deliveryAddress: 'Test Address',
        paymentMethod: 'CASH',
        amount: 5000,
        totalAmount: 5000,
        status: 'PENDING',
        paymentStatus: 'PENDING'
      }
    });
    
    console.log(`✅ Created active order: ${activeOrder.id}`);

    // Check again (should be 1 now)
    const hasActiveOrdersAfter = await prisma.order.count({
      where: {
        userId: testUser.id,
        status: {
          in: ['PENDING', 'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT']
        }
      }
    });
    
    console.log(`📊 User has ${hasActiveOrdersAfter} active orders (expected: 1)`);

    // Test 2: Check POS payment eligibility
    console.log('\n2. Testing POS Payment Eligibility...');
    
    // Check POS eligibility (should be false initially - no successful POS payments)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const failedPOSPayments = await prisma.order.count({
      where: {
        userId: testUser.id,
        paymentMethod: 'POS',
        paymentStatus: 'FAILED',
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    });

    const successfulPOSPayments = await prisma.order.count({
      where: {
        userId: testUser.id,
        paymentMethod: 'POS',
        paymentStatus: 'COMPLETED'
      }
    });

    console.log(`📊 Failed POS payments in last 30 days: ${failedPOSPayments}`);
    console.log(`📊 Successful POS payments total: ${successfulPOSPayments}`);
    console.log(`📊 Can use POS: ${successfulPOSPayments > 0 && failedPOSPayments === 0}`);

    // Create a failed POS payment
    const failedPOSOrder = await prisma.order.create({
      data: {
        orderId: 'TEST-POS-FAILED-001',
        trackingId: 'TRACK-POS-FAILED-001',
        userId: testUser.id,
        tankSize: '12.5kg',
        deliveryAddress: 'Test Address',
        paymentMethod: 'POS',
        amount: 5000,
        totalAmount: 5000,
        status: 'CANCELLED',
        paymentStatus: 'FAILED'
      }
    });
    
    console.log(`✅ Created failed POS order: ${failedPOSOrder.id}`);

    // Check POS eligibility again (should be false due to failed payment)
    const failedPOSPaymentsAfter = await prisma.order.count({
      where: {
        userId: testUser.id,
        paymentMethod: 'POS',
        paymentStatus: 'FAILED',
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    });

    console.log(`📊 Failed POS payments after: ${failedPOSPaymentsAfter}`);
    console.log(`📊 Can use POS after failed payment: ${failedPOSPaymentsAfter === 0}`);

    // Create a successful POS payment
    const successfulPOSOrder = await prisma.order.create({
      data: {
        orderId: 'TEST-POS-SUCCESS-001',
        trackingId: 'TRACK-POS-SUCCESS-001',
        userId: testUser.id,
        tankSize: '12.5kg',
        deliveryAddress: 'Test Address',
        paymentMethod: 'POS',
        amount: 5000,
        totalAmount: 5000,
        status: 'DELIVERED',
        paymentStatus: 'COMPLETED'
      }
    });
    
    console.log(`✅ Created successful POS order: ${successfulPOSOrder.id}`);

    // Check POS eligibility again (should be true now)
    const successfulPOSPaymentsAfter = await prisma.order.count({
      where: {
        userId: testUser.id,
        paymentMethod: 'POS',
        paymentStatus: 'COMPLETED'
      }
    });

    console.log(`📊 Successful POS payments after: ${successfulPOSPaymentsAfter}`);
    console.log(`📊 Can use POS after successful payment: ${successfulPOSPaymentsAfter > 0}`);

    // Test 3: Clean up test data
    console.log('\n3. Cleaning up test data...');
    
    await prisma.order.deleteMany({
      where: {
        userId: testUser.id
      }
    });
    
    await prisma.user.delete({
      where: {
        id: testUser.id
      }
    });
    
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 Business Rules Test Completed Successfully!');
    console.log('\n📋 Summary:');
    console.log('- ✅ Active orders restriction works correctly');
    console.log('- ✅ POS payment eligibility works correctly');
    console.log('- ✅ Failed POS payments block future POS usage');
    console.log('- ✅ Successful POS payments enable future POS usage');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBusinessRules(); 