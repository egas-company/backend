const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runSeedData() {
  try {
    console.log('Starting to seed database...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'seed-data.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sqlContent.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 50) + '...');
        await prisma.$executeRawUnsafe(statement);
      }
    }
    
    console.log('Database seeding completed successfully!');
    
    // Display summary
    const tankCount = await prisma.tankSize.count();
    const driverCount = await prisma.user.count({ where: { role: 'DRIVER' } });
    const driverProfileCount = await prisma.driver.count();
    
    console.log('\nSummary:');
    console.log(`- Tank Sizes: ${tankCount}`);
    console.log(`- Drivers: ${driverCount}`);
    console.log(`- Driver Profiles: ${driverProfileCount}`);
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
runSeedData(); 