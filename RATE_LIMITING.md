# Rate Limiting for Login Attempts

## Overview
The authentication system now implements rate limiting to prevent brute force attacks and abuse. Users are limited to **4 login attempts per day** per phone number and IP address.

## Features

### Daily Limit
- **4 failed login attempts per day** per phone number
- **4 failed login attempts per day** per IP address
- Resets at midnight (00:00) each day
- Applies to both OTP verification and driver login

### Tracking
- All login attempts are logged in the `LoginAttempt` table
- Records phone number, IP address, user agent, success status, and timestamp
- Separate tracking for phone number and IP address limits

### Error Messages
When users exceed the limit, they receive clear error messages:
- "Maximum login attempts exceeded for today. Please try again tomorrow."
- "Maximum login attempts exceeded for this IP address. Please try again tomorrow."
- For failed attempts: "Invalid OTP. You have X attempts remaining for today."

## Database Schema

### LoginAttempt Model
```prisma
model LoginAttempt {
  id           String   @id @default(cuid())
  phoneNumber  String
  ipAddress    String?
  userAgent    String?
  success      Boolean  @default(false)
  createdAt    DateTime @default(now())
  
  @@index([phoneNumber, createdAt])
  @@index([ipAddress, createdAt])
}
```

## API Endpoints

### Affected Endpoints
- `POST /auth/request-otp` - Checks limits before sending OTP
- `POST /auth/verify-otp` - Records attempts and enforces limits
- `POST /auth/driver/login` - Records attempts and enforces limits

### Debug Endpoint
- `GET /auth/login-attempts/:phoneNumber` - Check remaining attempts for a phone number

## Implementation Details

### Rate Limiting Functions
- `checkLoginAttempts()` - Validates if user can attempt login
- `recordLoginAttempt()` - Logs login attempt result
- `getRemainingAttempts()` - Returns remaining attempts count

### Security Features
- IP address tracking to prevent abuse from single IP
- User agent logging for additional security context
- Automatic cleanup of old records (can be implemented with cron jobs)

## Usage Examples

### Frontend Error Handling
The frontend automatically handles rate limiting errors through the existing error handler:

```typescript
// Error messages are automatically displayed to users
// No additional frontend changes required
```

### Checking Remaining Attempts
```bash
# Check remaining attempts for a phone number
GET /auth/login-attempts/+2347034528526
```

Response:
```json
{
  "success": true,
  "data": {
    "phoneAttempts": 2,
    "ipAttempts": 1,
    "remainingPhone": 2,
    "remainingIP": 3
  }
}
```

## Migration
The rate limiting feature requires a database migration:
```bash
npx prisma migrate dev --name add_login_attempts
```

## Future Enhancements
- Automatic cleanup of old login attempt records
- Configurable limits per user role
- Temporary account lockout after repeated failures
- Email/SMS notifications for suspicious activity 