-- Egas Database Seed Data
-- Add Tank Sizes
INSERT INTO "TankSize" (id, size, name, price, status, "createdAt", "updatedAt") VALUES
('tank_3kg', '3kg', 'Egas 3kg Standard', 3000, 'ACTIVE', NOW(), NOW()),
('tank_5kg', '5kg', 'Egas 5kg Standard', 4500, 'ACTIVE', NOW(), NOW()),
('tank_6kg', '6kg', 'Egas 6kg Standard', 5000, 'ACTIVE', NOW(), NOW()),
('tank_10kg', '10kg', 'Egas 10kg Standard', 7500, 'ACTIVE', NOW(), NOW()),
('tank_12kg', '12.5kg', 'Egas 12.5kg Standard', 8500, 'ACTIVE', NOW(), NOW()),
('tank_14kg', '14kg', 'Egas 14kg Standard', 10000, 'ACTIVE', NOW(), NOW()),
('tank_25kg', '25kg', 'Egas 25kg Standard', 15000, 'ACTIVE', NOW(), NOW()),
('tank_50kg', '50kg', 'Egas 50kg Standard', 25000, 'ACTIVE', NOW(), NOW()),
('tank_100kg', '100kg', 'Egas 100kg Commercial', 45000, 'ACTIVE', NOW(), NOW()),
('tank_150kg', '150kg', 'Egas 150kg Commercial', 65000, 'ACTIVE', NOW(), NOW()),
('tank_200kg', '200kg', 'Egas 200kg Commercial', 85000, 'ACTIVE', NOW(), NOW())
ON CONFLICT (size) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  status = EXCLUDED.status,
  "updatedAt" = NOW();

-- Add Driver Users
INSERT INTO "User" (id, email, "phoneNumber", password, "firstName", "lastName", role, verified, "isActive", "isDeleted", "createdAt", "updatedAt") VALUES
('driver_1', 'driver1@example.com', '+2349044444444', '$2a$10$rQZ8K9mN2pL3vX7yJ1hG5tR6uI8oP9qW0eS1aB2cD3fE4gH5iJ6kL7mN8oP9', 'Michael', 'Okon', 'DRIVER', true, true, false, NOW(), NOW()),
('driver_2', 'driver2@example.com', '+2349055555555', '$2a$10$rQZ8K9mN2pL3vX7yJ1hG5tR6uI8oP9qW0eS1aB2cD3fE4gH5iJ6kL7mN8oP9', 'David', 'Adebayo', 'DRIVER', true, true, false, NOW(), NOW()),
('driver_3', 'driver3@example.com', '+2349066666666', '$2a$10$rQZ8K9mN2pL3vX7yJ1hG5tR6uI8oP9qW0eS1aB2cD3fE4gH5iJ6kL7mN8oP9', 'Emeka', 'Okechukwu', 'DRIVER', true, true, false, NOW(), NOW()),
('driver_4', 'driver4@example.com', '+2349077777777', '$2a$10$rQZ8K9mN2pL3vX7yJ1hG5tR6uI8oP9qW0eS1aB2cD3fE4gH5iJ6kL7mN8oP9', 'Kemi', 'Adeleke', 'DRIVER', true, true, false, NOW(), NOW()),
('driver_5', 'driver5@example.com', '+2349088888888', '$2a$10$rQZ8K9mN2pL3vX7yJ1hG5tR6uI8oP9qW0eS1aB2cD3fE4gH5iJ6kL7mN8oP9', 'Tunde', 'Bakare', 'DRIVER', true, true, false, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET
  "firstName" = EXCLUDED."firstName",
  "lastName" = EXCLUDED."lastName",
  "phoneNumber" = EXCLUDED."phoneNumber",
  "updatedAt" = NOW();

-- Add Driver Profiles
INSERT INTO "Driver" (id, "userId", "isAvailable", "currentLat", "currentLong", "vehicleType", "vehiclePlate", "licenseNumber", "totalTrips", rating, "createdAt", "updatedAt") VALUES
('driver_profile_1', 'driver_1', true, 6.6018, 3.3515, 'Truck', 'LAG-123-XY', 'DL12345', 50, 4.8, NOW(), NOW()),
('driver_profile_2', 'driver_2', true, 6.5244, 3.3792, 'Van', 'LAG-456-AB', 'DL67890', 35, 4.6, NOW(), NOW()),
('driver_profile_3', 'driver_3', true, 6.6018, 3.3515, 'Truck', 'LAG-789-CD', 'DL11111', 42, 4.9, NOW(), NOW()),
('driver_profile_4', 'driver_4', true, 6.5244, 3.3792, 'Van', 'LAG-012-EF', 'DL22222', 28, 4.7, NOW(), NOW()),
('driver_profile_5', 'driver_5', true, 6.6018, 3.3515, 'Truck', 'LAG-345-GH', 'DL33333', 65, 4.5, NOW(), NOW())
ON CONFLICT ("userId") DO UPDATE SET
  "isAvailable" = EXCLUDED."isAvailable",
  "currentLat" = EXCLUDED."currentLat",
  "currentLong" = EXCLUDED."currentLong",
  "vehicleType" = EXCLUDED."vehicleType",
  "vehiclePlate" = EXCLUDED."vehiclePlate",
  "licenseNumber" = EXCLUDED."licenseNumber",
  "totalTrips" = EXCLUDED."totalTrips",
  rating = EXCLUDED.rating,
  "updatedAt" = NOW();

-- Insert Driver Documents
INSERT INTO "DriverDocument" (id, "driverId", type, url, verified, "uploadedAt", "verifiedAt", "verifiedBy", "expiryDate", "createdAt", "updatedAt") VALUES
-- Driver 1 Documents
('doc1_license', 'driver_profile_1', 'LICENSE', 'https://storage.example.com/driver1/license.pdf', true, NOW(), NOW(), 'admin_user_id', '2025-12-31', NOW(), NOW()),
('doc1_vehicle', 'driver_profile_1', 'VEHICLE_REGISTRATION', 'https://storage.example.com/driver1/vehicle_registration.pdf', true, NOW(), NOW(), 'admin_user_id', '2025-12-31', NOW(), NOW()),
('doc1_insurance', 'driver_profile_1', 'INSURANCE', 'https://storage.example.com/driver1/insurance.pdf', true, NOW(), NOW(), 'admin_user_id', '2025-12-31', NOW(), NOW()),

-- Driver 2 Documents
('doc2_license', 'driver_profile_2', 'LICENSE', 'https://storage.example.com/driver2/license.pdf', true, NOW(), NOW(), 'admin_user_id', '2025-12-31', NOW(), NOW()),
('doc2_vehicle', 'driver_profile_2', 'VEHICLE_REGISTRATION', 'https://storage.example.com/driver2/vehicle_registration.pdf', true, NOW(), NOW(), 'admin_user_id', '2025-12-31', NOW(), NOW()),
('doc2_insurance', 'driver_profile_2', 'INSURANCE', 'https://storage.example.com/driver2/insurance.pdf', true, NOW(), NOW(), 'admin_user_id', '2025-12-31', NOW(), NOW()),

-- Driver 3 Documents
('doc3_license', 'driver_profile_3', 'LICENSE', 'https://storage.example.com/driver3/license.pdf', true, NOW(), NOW(), 'admin_user_id', '2025-12-31', NOW(), NOW()),
('doc3_vehicle', 'driver_profile_3', 'VEHICLE_REGISTRATION', 'https://storage.example.com/driver3/vehicle_registration.pdf', true, NOW(), NOW(), 'admin_user_id', '2025-12-31', NOW(), NOW()),
('doc3_insurance', 'driver_profile_3', 'INSURANCE', 'https://storage.example.com/driver3/insurance.pdf', true, NOW(), NOW(), 'admin_user_id', '2025-12-31', NOW(), NOW()),

-- Driver 4 Documents
('doc4_license', 'driver_profile_4', 'LICENSE', 'https://storage.example.com/driver4/license.pdf', true, NOW(), NOW(), 'admin_user_id', '2025-12-31', NOW(), NOW()),
('doc4_vehicle', 'driver_profile_4', 'VEHICLE_REGISTRATION', 'https://storage.example.com/driver4/vehicle_registration.pdf', true, NOW(), NOW(), 'admin_user_id', '2025-12-31', NOW(), NOW()),
('doc4_insurance', 'driver_profile_4', 'INSURANCE', 'https://storage.example.com/driver4/insurance.pdf', true, NOW(), NOW(), 'admin_user_id', '2025-12-31', NOW(), NOW()),

-- Driver 5 Documents
('doc5_license', 'driver_profile_5', 'LICENSE', 'https://storage.example.com/driver5/license.pdf', true, NOW(), NOW(), 'admin_user_id', '2025-12-31', NOW(), NOW()),
('doc5_vehicle', 'driver_profile_5', 'VEHICLE_REGISTRATION', 'https://storage.example.com/driver5/vehicle_registration.pdf', true, NOW(), NOW(), 'admin_user_id', '2025-12-31', NOW(), NOW()),
('doc5_insurance', 'driver_profile_5', 'INSURANCE', 'https://storage.example.com/driver5/insurance.pdf', true, NOW(), NOW(), 'admin_user_id', '2025-12-31', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  verified = EXCLUDED.verified,
  "verifiedAt" = EXCLUDED."verifiedAt",
  "updatedAt" = NOW();

-- Create a sample client user if it doesn't exist
INSERT INTO "User" (id, email, "phoneNumber", password, "firstName", "lastName", role, verified, "isActive", "isDeleted", address, latitude, longitude, "createdAt", "updatedAt") VALUES
('client_1', 'client1@example.com', '+2349022222222', '$2a$10$rQZ8K9mN2pL3vX7yJ1hG5tR6uI8oP9qW0eS1aB2cD3fE4gH5iJ6kL7mN8oP9', 'John', 'Doe', 'CLIENT', true, true, false, '123 Ikeja Street, Lagos', 6.6018, 3.3515, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Create a sample admin user if it doesn't exist
INSERT INTO "User" (id, email, "phoneNumber", password, "firstName", "lastName", role, verified, "isActive", "isDeleted", "createdAt", "updatedAt") VALUES
('admin_1', 'admin@example.com', '+2349011111111', '$2a$10$rQZ8K9mN2pL3vX7yJ1hG5tR6uI8oP9qW0eS1aB2cD3fE4gH5iJ6kL7mN8oP9', 'Admin', 'User', 'ADMIN', true, true, false, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Insert Sample Orders
INSERT INTO "Order" (id, "trackingId", "orderId", "userId", "driverId", "tankSize", quantity, "deliveryAddress", "deliveryLatitude", "deliveryLongitude", "paymentMethod", "paymentStatus", "shippingFee", amount, "totalAmount", status, "tankSizeId", "createdAt", "updatedAt") VALUES
('order_1', 'TRACK001', 'ORDER001', 'client_1', 'driver_profile_1', '6kg', 2, '123 Ikeja Street, Lagos', 6.6018, 3.3515, 'CASH', 'PAID', 500, 10000, 10500, 'DELIVERED', 'tank_6kg', NOW(), NOW()),
('order_2', 'TRACK002', 'ORDER002', 'client_1', 'driver_profile_2', '12.5kg', 1, '456 Victoria Island, Lagos', 6.4281, 3.4219, 'CARD', 'PAID', 800, 8500, 9300, 'IN_TRANSIT', 'tank_12kg', NOW(), NOW()),
('order_3', 'TRACK003', 'ORDER003', 'client_1', 'driver_profile_3', '25kg', 1, '789 Lekki Phase 1, Lagos', 6.4550, 3.4560, 'BANK_TRANSFER', 'PENDING', 1200, 15000, 16200, 'ASSIGNED', 'tank_25kg', NOW(), NOW())
ON CONFLICT ("trackingId") DO UPDATE SET
  status = EXCLUDED.status,
  "paymentStatus" = EXCLUDED."paymentStatus",
  "updatedAt" = NOW();

-- Insert Driver Ratings
INSERT INTO "DriverRating" (id, "orderId", rating, comment, "createdAt") VALUES
('rating_1', 'order_1', 5, 'Excellent service! Very professional driver.', NOW()),
('rating_2', 'order_2', 4, 'Good service, arrived on time.', NOW())
ON CONFLICT ("orderId") DO UPDATE SET
  rating = EXCLUDED.rating,
  comment = EXCLUDED.comment;

-- Update order delivery times for completed orders
UPDATE "Order" SET 
  "deliveredAt" = NOW() - INTERVAL '2 hours',
  "assignedAt" = NOW() - INTERVAL '4 hours',
  "acceptedAt" = NOW() - INTERVAL '3 hours',
  "pickedUpAt" = NOW() - INTERVAL '2 hours 30 minutes'
WHERE "trackingId" = 'TRACK001';

UPDATE "Order" SET 
  "assignedAt" = NOW() - INTERVAL '1 hour',
  "acceptedAt" = NOW() - INTERVAL '30 minutes'
WHERE "trackingId" = 'TRACK002';

UPDATE "Order" SET 
  "assignedAt" = NOW() - INTERVAL '15 minutes'
WHERE "trackingId" = 'TRACK003';

-- Display summary
SELECT 'Tank Sizes' as category, COUNT(*) as count FROM "TankSize"
UNION ALL
SELECT 'Drivers' as category, COUNT(*) as count FROM "User" WHERE role = 'DRIVER'
UNION ALL
SELECT 'Driver Documents' as category, COUNT(*) as count FROM "DriverDocument"
UNION ALL
SELECT 'Orders' as category, COUNT(*) as count FROM "Order"
UNION ALL
SELECT 'Driver Ratings' as category, COUNT(*) as count FROM "DriverRating"; 