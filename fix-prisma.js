const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Prisma Fix Script for VPS');
console.log('============================\n');

async function runCommand(command, description) {
  try {
    console.log(`📋 ${description}...`);
    const result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    console.log(`✅ ${description} completed successfully`);
    return result;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    return null;
  }
}

async function checkEnvironment() {
  console.log('🔍 Checking environment variables...');
  
  // Check if .env file exists
  if (!fs.existsSync('.env')) {
    console.error('❌ .env file not found');
    return false;
  }
  
  // Read .env file
  const envContent = fs.readFileSync('.env', 'utf8');
  
  // Check for DATABASE_URL
  if (!envContent.includes('DATABASE_URL=')) {
    console.error('❌ DATABASE_URL not found in .env file');
    return false;
  }
  
  console.log('✅ Environment variables check passed');
  return true;
}

async function fixPrisma() {
  console.log('\n🚀 Starting Prisma fix process...\n');
  
  // Step 1: Check environment
  const envOk = await checkEnvironment();
  if (!envOk) {
    console.log('\n❌ Environment check failed. Please ensure .env file exists with DATABASE_URL');
    return;
  }
  
  // Step 2: Remove existing Prisma artifacts
  console.log('\n🧹 Cleaning up existing Prisma artifacts...');
  try {
    if (fs.existsSync('node_modules/.prisma')) {
      fs.rmSync('node_modules/.prisma', { recursive: true, force: true });
      console.log('✅ Removed existing Prisma client');
    }
  } catch (error) {
    console.log('⚠️  Could not remove existing Prisma client:', error.message);
  }
  
  // Step 3: Install dependencies
  await runCommand('npm install', 'Installing dependencies');
  
  // Step 4: Generate Prisma client
  await runCommand('npx prisma generate', 'Generating Prisma client');
  
  // Step 5: Check migration status
  await runCommand('npx prisma migrate status', 'Checking migration status');
  
  // Step 6: Deploy migrations if needed
  await runCommand('npx prisma migrate deploy', 'Deploying migrations');
  
  // Step 7: Test database connection
  console.log('\n🔍 Testing database connection...');
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test basic operations
    const userCount = await prisma.user.count();
    console.log(`✅ User table accessible, count: ${userCount}`);
    
    const loginAttemptCount = await prisma.loginAttempt.count();
    console.log(`✅ LoginAttempt table accessible, count: ${loginAttemptCount}`);
    
    await prisma.$disconnect();
    console.log('✅ Database connection closed');
    
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
  }
  
  console.log('\n🎉 Prisma fix process completed!');
  console.log('\n📝 Next steps:');
  console.log('1. Restart your application: pm2 restart all');
  console.log('2. Monitor logs: pm2 logs');
  console.log('3. Test OTP functionality');
}

// Run the fix
fixPrisma().catch(console.error); 