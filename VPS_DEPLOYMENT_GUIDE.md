# VPS Deployment Guide - Prisma Fix

## Current Issue
```
TypeError: Cannot read properties of undefined (reading 'count')
at checkLoginAttempts (rateLimiter.ts:13:54)
```

This error indicates that the Prisma client is not properly initialized on your VPS.

## Quick Fix Commands

### Step 1: Navigate to Project Directory
```bash
cd /path/to/your/egas/project/backend
```

### Step 2: Run the Prisma Fix Script
```bash
node fix-prisma.js
```

This script will:
- ✅ Check environment variables
- ✅ Clean up existing Prisma artifacts
- ✅ Reinstall dependencies
- ✅ Regenerate Prisma client
- ✅ Deploy migrations
- ✅ Test database connection

### Step 3: Restart Application
```bash
# If using PM2
pm2 restart all

# If using npm
npm run dev
```

### Step 4: Test Health Check
```bash
curl http://localhost:5000/health
```

## Manual Fix Steps (if script fails)

### 1. Check Environment Variables
```bash
# Check if .env file exists
ls -la .env

# View .env content (make sure DATABASE_URL is set)
cat .env
```

### 2. Clean Prisma Artifacts
```bash
# Remove existing Prisma client
rm -rf node_modules/.prisma

# Remove node_modules (optional, if issues persist)
rm -rf node_modules
```

### 3. Reinstall Dependencies
```bash
npm install
```

### 4. Generate Prisma Client
```bash
npx prisma generate
```

### 5. Deploy Migrations
```bash
npx prisma migrate deploy
```

### 6. Test Database Connection
```bash
node test-db-connection.js
```

## Verification Steps

### 1. Check Application Logs
```bash
# Monitor logs for Prisma initialization
pm2 logs

# Look for these success messages:
# ✅ Prisma client connected successfully
# ✅ Database connection successful
```

### 2. Test OTP Endpoint
```bash
curl -X POST http://localhost:5000/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "2349061775633"}'
```

### 3. Check Health Endpoint
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": {
    "connected": true,
    "userCount": 8,
    "loginAttemptCount": 0
  }
}
```

## Troubleshooting

### If DATABASE_URL is missing:
```bash
# Add to .env file
echo 'DATABASE_URL="postgresql://postgres:[password]@aws-0-eu-west-3.pooler.supabase.com:6543/postgres"' >> .env
```

### If network connectivity fails:
```bash
# Test connection to Supabase
telnet aws-0-eu-west-3.pooler.supabase.com 6543

# Or use curl
curl -I https://api.supabase.com
```

### If Prisma client generation fails:
```bash
# Check Prisma schema
npx prisma validate

# Reset Prisma
npx prisma db push --force-reset
npx prisma generate
```

### If migrations fail:
```bash
# Check migration status
npx prisma migrate status

# Reset migrations (WARNING: This will reset your database)
npx prisma migrate reset
```

## Expected Results

After successful fix:
- ✅ No more "Cannot read properties of undefined" errors
- ✅ OTP requests work properly
- ✅ Rate limiting functions correctly
- ✅ Health check shows database connected
- ✅ Application logs show Prisma initialization success

## Monitoring

### Key Log Messages to Watch For:
```
✅ Prisma client connected successfully
✅ Database connection successful
✅ OTP sent successfully
```

### Error Messages to Watch For:
```
❌ Prisma client connection failed
❌ DATABASE_URL environment variable is not set
❌ Database connection test failed
```

## Next Steps

1. Deploy the updated code to VPS
2. Run `node fix-prisma.js`
3. Restart the application
4. Test OTP functionality
5. Monitor logs for any remaining issues

## Support

If issues persist after following this guide:
1. Check the application logs for specific error messages
2. Verify the DATABASE_URL is correct
3. Ensure network connectivity to Supabase
4. Test database connection manually 