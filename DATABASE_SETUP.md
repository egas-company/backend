# Database Setup and Seeding

## Overview
This document explains how to set up the database with tank sizes and drivers for the Egas application.

## Database Schema
The application uses PostgreSQL with the following main tables:
- `TankSize` - Different gas tank sizes and prices
- `User` - Users including drivers, clients, and admins
- `Driver` - Driver profiles with vehicle and location information
- `DriverDocument` - Driver verification documents
- `Order` - Gas delivery orders
- `DriverRating` - Customer ratings for drivers

## Tank Sizes Added
The following tank sizes are available:

| Size | Name | Price (₦) | Type |
|------|------|-----------|------|
| 3kg | Egas 3kg Standard | 3,000 | Residential |
| 5kg | Egas 5kg Standard | 4,500 | Residential |
| 6kg | Egas 6kg Standard | 5,000 | Residential |
| 10kg | Egas 10kg Standard | 7,500 | Residential |
| 12.5kg | Egas 12.5kg Standard | 8,500 | Residential |
| 14kg | Egas 14kg Standard | 10,000 | Residential |
| 25kg | Egas 25kg Standard | 15,000 | Commercial |
| 50kg | Egas 50kg Standard | 25,000 | Commercial |
| 100kg | Egas 100kg Commercial | 45,000 | Commercial |
| 150kg | Egas 150kg Commercial | 65,000 | Commercial |
| 200kg | Egas 200kg Commercial | 85,000 | Commercial |

## Drivers Added
Five sample drivers are included:

1. **Michael Okon** (driver1@example.com)
   - Vehicle: Truck (LAG-123-XY)
   - Rating: 4.8/5
   - Total Trips: 50

2. **David Adebayo** (driver2@example.com)
   - Vehicle: Van (LAG-456-AB)
   - Rating: 4.6/5
   - Total Trips: 35

3. **Emeka Okechukwu** (driver3@example.com)
   - Vehicle: Truck (LAG-789-CD)
   - Rating: 4.9/5
   - Total Trips: 42

4. **Kemi Adeleke** (driver4@example.com)
   - Vehicle: Van (LAG-012-EF)
   - Rating: 4.7/5
   - Total Trips: 28

5. **Tunde Bakare** (driver5@example.com)
   - Vehicle: Truck (LAG-345-GH)
   - Rating: 4.5/5
   - Total Trips: 65

All drivers have:
- Verified accounts
- Complete documentation (License, Vehicle Registration, Insurance)
- Active status
- Lagos area coverage

## Adding Data to Database

### Option 1: Using Prisma Seed (Recommended)
When network connection is available:

```bash
cd egasApp2-main/backend
npx prisma db seed
```

### Option 2: Using SQL Script
Run the SQL script directly in your database:

```bash
cd egasApp2-main/backend
node run-seed.js
```

### Option 3: Manual SQL Execution
Copy and paste the contents of `seed-data.sql` into your database management tool.

## Verification
After seeding, you can verify the data:

```sql
-- Check tank sizes
SELECT * FROM "TankSize" ORDER BY price;

-- Check drivers
SELECT u."firstName", u."lastName", d."vehicleType", d."vehiclePlate", d.rating 
FROM "User" u 
JOIN "Driver" d ON u.id = d."userId" 
WHERE u.role = 'DRIVER';

-- Check driver documents
SELECT u."firstName", dd.type, dd.verified 
FROM "User" u 
JOIN "Driver" d ON u.id = d."userId" 
JOIN "DriverDocument" dd ON d.id = dd."driverId" 
WHERE u.role = 'DRIVER';
```

## Default Passwords
All seeded users have the password: `password123`

## Rate Limiting
The system now includes rate limiting for login attempts:
- Maximum 4 failed login attempts per day per phone number
- Maximum 4 failed login attempts per day per IP address
- Resets at midnight each day

## Troubleshooting

### Network Connection Issues
If you encounter network issues:
1. Check your internet connection
2. Verify database credentials in `.env` file
3. Try running the SQL script directly in your database tool

### Duplicate Data
The scripts use `ON CONFLICT` clauses to handle duplicate data gracefully. If you need to start fresh:
1. Delete existing data manually
2. Run the seed script again

### Password Issues
If you need to reset passwords:
```sql
UPDATE "User" 
SET password = '$2a$10$rQZ8K9mN2pL3vX7yJ1hG5tR6uI8oP9qW0eS1aB2cD3fE4gH5iJ6kL7mN8oP9' 
WHERE email LIKE 'driver%@example.com';
``` 