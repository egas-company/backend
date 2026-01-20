# VPS Troubleshooting Guide

## Current Issue: Database Connection Error

### Error Description
```
TypeError: Cannot read properties of undefined (reading 'count')
at checkLoginAttempts (rateLimiter.ts:12:52)
```

### Root Cause Analysis
The error indicates that `prisma` is undefined when trying to access `prisma.loginAttempt.count()`. This suggests:

1. **Database Connection Issue**: Prisma client not properly initialized
2. **Environment Variables**: Missing or incorrect database URL
3. **Network Connectivity**: VPS can't connect to Supabase database
4. **Prisma Client Generation**: Prisma client not generated on VPS

## Immediate Fixes Applied

### 1. Enhanced Error Handling
- Added try-catch blocks around all database operations
- Implemented fallback mechanisms to continue functionality
- Added comprehensive logging for debugging

### 2. Graceful Degradation
- OTP functionality continues to work even if rate limiting fails
- Rate limiting errors are logged but don't block requests
- Database errors are handled gracefully

## VPS Deployment Checklist

### 1. Environment Variables
```bash
# Check if DATABASE_URL is set
echo $DATABASE_URL

# Should look like:
# postgresql://postgres:[password]@aws-0-eu-west-3.pooler.supabase.com:6543/postgres
```

### 2. Database Connectivity Test
```bash
# Test database connection from VPS
cd /path/to/your/project/backend
node test-db-connection.js
```

### 3. Prisma Setup
```bash
# Generate Prisma client
npx prisma generate

# Check if migrations are applied
npx prisma migrate status

# Apply migrations if needed
npx prisma migrate deploy
```

### 4. Network Connectivity
```bash
# Test connection to Supabase
telnet aws-0-eu-west-3.pooler.supabase.com 6543

# Or use curl to test HTTP connectivity
curl -I https://api.supabase.com
```

## Step-by-Step Resolution

### Step 1: Verify Environment Variables
```bash
# On your VPS, check the .env file
cat .env

# Ensure DATABASE_URL is present and correct
# DATABASE_URL="postgresql://postgres:[password]@aws-0-eu-west-3.pooler.supabase.com:6543/postgres"
```

### Step 2: Test Database Connection
```bash
# Run the database connection test
node test-db-connection.js
```

### Step 3: Regenerate Prisma Client
```bash
# Remove existing Prisma client
rm -rf node_modules/.prisma

# Reinstall dependencies
npm install

# Generate Prisma client
npx prisma generate
```

### Step 4: Check Application Logs
```bash
# Monitor application logs for database errors
pm2 logs

# Or if using npm start
npm start
```

### Step 5: Restart Application
```bash
# Restart the application after fixes
pm2 restart all

# Or if using npm
npm run dev
```

## Alternative Solutions

### Option 1: Disable Rate Limiting Temporarily
If database issues persist, you can temporarily disable rate limiting:

```typescript
// In src/controllers/auth.ts, comment out the rate limiting check
// await checkLoginAttempts(phoneNumber, ipAddress);
```

### Option 2: Use In-Memory Rate Limiting
Implement a simple in-memory rate limiting solution as a fallback.

### Option 3: Database Connection Pooling
Configure Prisma with connection pooling settings:

```typescript
// In src/lib/prisma.ts
export const prisma: PrismaClient =
  prismaGlobal.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
```

## Monitoring and Debugging

### Key Logs to Watch
- Database connection errors
- Prisma client initialization
- Rate limiting failures
- OTP generation/sending errors

### Health Check Endpoint
Consider adding a health check endpoint to monitor database connectivity:

```typescript
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', database: 'disconnected', error: error.message });
  }
});
```

## Expected Outcome

After applying these fixes:
1. ✅ OTP requests should work even if rate limiting fails
2. ✅ Better error messages and logging
3. ✅ Graceful handling of database connection issues
4. ✅ Application continues to function with degraded rate limiting

## Next Steps

1. Deploy the updated code to VPS
2. Run the database connection test
3. Monitor application logs
4. Verify OTP functionality works
5. Check if rate limiting is working properly 