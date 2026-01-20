import { PrismaClient, UserRole, OrderStatus, PaymentType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma: PrismaClient = new PrismaClient();

const tankSizes = [
  { size: "3kg", price: 3000, name: "Egas 3kg Standard" },
  { size: "5kg", price: 4500, name: "Egas 5kg Standard" },
  { size: "6kg", price: 5000, name: "Egas 6kg Standard" },
  { size: "10kg", price: 7500, name: "Egas 10kg Standard" },
  { size: "12.5kg", price: 8500, name: "Egas 12.5kg Standard" },
  { size: "14kg", price: 10000, name: "Egas 14kg Standard" },
  { size: "25kg", price: 15000, name: "Egas 25kg Standard" },
  { size: "50kg", price: 25000, name: "Egas 50kg Standard" },
  { size: "100kg", price: 45000, name: "Egas 100kg Commercial" },
  { size: "150kg", price: 65000, name: "Egas 150kg Commercial" },
  { size: "200kg", price: 85000, name: "Egas 200kg Commercial" },
];

async function main() {
  console.log('Starting seeding process...');

  // Seed Tank Sizes
  console.log('Seeding tank sizes...');
  for (const tankSize of tankSizes) {
    await prisma.tankSize.upsert({
      where: { size: tankSize.size },
      update: {},
      create: tankSize,
    });
  }

  // Seed Admin User
  console.log('Seeding admin...');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      phoneNumber: '+2349011111111',
      password: await bcrypt.hash('admin123', 10),
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      verified: true,
      isActive: true,
    },
  });

  // Seed Client Users
  console.log('Seeding clients...');
  const client1 = await prisma.user.upsert({
    where: { email: 'client1@example.com' },
    update: {},
    create: {
      email: 'client1@example.com',
      phoneNumber: '+2349022222222',
      password: await bcrypt.hash('password123', 10),
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.CLIENT,
      verified: true,
      isActive: true,
      address: '123 Ikeja Street',
      latitude: 6.6018,
      longitude: 3.3515,
    },
  });

  // Seed Drivers
  console.log('Seeding drivers...');
  const drivers = [
    {
      email: 'driver1@example.com',
      phoneNumber: '+2349044444444',
      firstName: 'Michael',
      lastName: 'Okon',
      vehicleType: 'Truck',
      vehiclePlate: 'LAG-123-XY',
      licenseNumber: 'DL12345',
      totalTrips: 50,
      rating: 4.8,
      currentLat: 6.6018,
      currentLong: 3.3515,
    },
    {
      email: 'driver2@example.com',
      phoneNumber: '+2349055555555',
      firstName: 'David',
      lastName: 'Adebayo',
      vehicleType: 'Van',
      vehiclePlate: 'LAG-456-AB',
      licenseNumber: 'DL67890',
      totalTrips: 35,
      rating: 4.6,
      currentLat: 6.5244,
      currentLong: 3.3792,
    },
    {
      email: 'driver3@example.com',
      phoneNumber: '+2349066666666',
      firstName: 'Emeka',
      lastName: 'Okechukwu',
      vehicleType: 'Truck',
      vehiclePlate: 'LAG-789-CD',
      licenseNumber: 'DL11111',
      totalTrips: 42,
      rating: 4.9,
      currentLat: 6.6018,
      currentLong: 3.3515,
    },
    {
      email: 'driver4@example.com',
      phoneNumber: '+2349077777777',
      firstName: 'Kemi',
      lastName: 'Adeleke',
      vehicleType: 'Van',
      vehiclePlate: 'LAG-012-EF',
      licenseNumber: 'DL22222',
      totalTrips: 28,
      rating: 4.7,
      currentLat: 6.5244,
      currentLong: 3.3792,
    },
    {
      email: 'driver5@example.com',
      phoneNumber: '+2349088888888',
      firstName: 'Tunde',
      lastName: 'Bakare',
      vehicleType: 'Truck',
      vehiclePlate: 'LAG-345-GH',
      licenseNumber: 'DL33333',
      totalTrips: 65,
      rating: 4.5,
      currentLat: 6.6018,
      currentLong: 3.3515,
    },
  ];

  const createdDrivers = [];
  for (const driverData of drivers) {
    const driver = await prisma.user.upsert({
      where: { email: driverData.email },
      update: {},
      create: {
        email: driverData.email,
        phoneNumber: driverData.phoneNumber,
        password: await bcrypt.hash('password123', 10),
        firstName: driverData.firstName,
        lastName: driverData.lastName,
        role: UserRole.DRIVER,
        verified: true,
        isActive: true,
        driver: {
          create: {
            isAvailable: true,
            currentLat: driverData.currentLat,
            currentLong: driverData.currentLong,
            vehicleType: driverData.vehicleType,
            vehiclePlate: driverData.vehiclePlate,
            licenseNumber: driverData.licenseNumber,
            totalTrips: driverData.totalTrips,
            rating: driverData.rating,
          },
        },
      },
      include: { driver: true },
    });
    createdDrivers.push(driver);
  }

  const driver1 = createdDrivers[0]; // Keep reference to first driver for existing code

  // Seed Driver Documents
  console.log('Seeding driver documents...');
  const documentTypes = ['LICENSE', 'VEHICLE_REGISTRATION', 'INSURANCE'];
  
  for (let i = 0; i < createdDrivers.length; i++) {
    const driver = createdDrivers[i];
    if (driver.driver) {
      for (const docType of documentTypes) {
        await prisma.driverDocument.upsert({
          where: { id: `doc${i + 1}_${docType}` },
          update: {},
          create: {
            id: `doc${i + 1}_${docType}`,
            driverId: driver.driver.id,
            type: docType,
            url: `https://storage.example.com/driver${i + 1}/${docType.toLowerCase()}.pdf`,
            verified: true,
            uploadedAt: new Date(),
            verifiedAt: new Date(),
            verifiedBy: admin.id,
            expiryDate: new Date('2025-12-31'),
          },
        });
      }
    } else {
      console.error(`Driver relation not found for driver${i + 1}`);
    }
  }

  // Seed Orders
  console.log('Seeding orders...');
  const tankSize6kg = await prisma.tankSize.findUnique({ where: { size: '6kg' } });
  const tankSize12kg = await prisma.tankSize.findUnique({ where: { size: '12.5kg' } });
  const tankSize25kg = await prisma.tankSize.findUnique({ where: { size: '25kg' } });
  
  if (!tankSize6kg || !tankSize12kg || !tankSize25kg) {
    throw new Error('Required tank sizes not found');
  }

  const orders = [
    {
      trackingId: 'TRACK001',
      orderId: 'ORDER001',
      userId: client1.id,
      driverId: createdDrivers[0].driver?.id ?? null,
      tankSize: '6kg',
      quantity: 2,
      deliveryAddress: '123 Ikeja Street, Lagos',
      deliveryLatitude: 6.6018,
      deliveryLongitude: 3.3515,
      paymentMethod: PaymentType.CASH,
      paymentStatus: 'PAID',
      shippingFee: 500,
      amount: 10000,
      totalAmount: 10500,
      status: OrderStatus.DELIVERED,
      deliveredAt: new Date(),
      tankSizeId: tankSize6kg.id,
    },
    {
      trackingId: 'TRACK002',
      orderId: 'ORDER002',
      userId: client1.id,
      driverId: createdDrivers[1].driver?.id ?? null,
      tankSize: '12.5kg',
      quantity: 1,
      deliveryAddress: '456 Victoria Island, Lagos',
      deliveryLatitude: 6.4281,
      deliveryLongitude: 3.4219,
      paymentMethod: PaymentType.CARD,
      paymentStatus: 'PAID',
      shippingFee: 800,
      amount: 8500,
      totalAmount: 9300,
      status: OrderStatus.IN_TRANSIT,
      tankSizeId: tankSize12kg.id,
    },
    {
      trackingId: 'TRACK003',
      orderId: 'ORDER003',
      userId: client1.id,
      driverId: createdDrivers[2].driver?.id ?? null,
      tankSize: '25kg',
      quantity: 1,
      deliveryAddress: '789 Lekki Phase 1, Lagos',
      deliveryLatitude: 6.4550,
      deliveryLongitude: 3.4560,
      paymentMethod: PaymentType.BANK_TRANSFER,
      paymentStatus: 'PENDING',
      shippingFee: 1200,
      amount: 15000,
      totalAmount: 16200,
      status: OrderStatus.ASSIGNED,
      tankSizeId: tankSize25kg.id,
    },
  ];

  const createdOrders = [];
  for (const orderData of orders) {
    const order = await prisma.order.upsert({
      where: { trackingId: orderData.trackingId },
      update: {},
      create: orderData,
    });
    createdOrders.push(order);
  }

  const order1 = createdOrders[0]; // Keep reference to first order for existing code

  // Seed Driver Ratings
  console.log('Seeding driver ratings...');
  const ratings = [
    { orderId: createdOrders[0].id, rating: 5, comment: 'Excellent service! Very professional driver.' },
    { orderId: createdOrders[1].id, rating: 4, comment: 'Good service, arrived on time.' },
  ];

  for (const ratingData of ratings) {
    await prisma.driverRating.upsert({
      where: { orderId: ratingData.orderId },
      update: {},
      create: ratingData,
    });
  }

  // Seed Password Reset
  console.log('Seeding password resets...');
  await prisma.passwordReset.upsert({
    where: { token: 'reset-token-123' },
    update: {},
    create: {
      userId: client1.id,
      token: 'reset-token-123',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    },
  });

  // Seed OTP
  console.log('Seeding OTPs...');
  await prisma.otp.upsert({
    where: { id: 'otp1' },
    update: {},
    create: {
      id: 'otp1',
      phoneNumber: client1.phoneNumber,
      code: '123456',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
      userId: client1.id,
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });