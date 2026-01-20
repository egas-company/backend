# Business Rules Implementation

## Overview

This document outlines the robust business rules implemented to ensure proper order management and payment processing in the EGas application.

## Business Rules

### 1. Single Active Order Restriction

**Rule**: Users cannot place more than one active order at a time.

**Implementation**:
- **Active Order Statuses**: `PENDING`, `ASSIGNED`, `ACCEPTED`, `PICKED_UP`, `IN_TRANSIT`
- **Check Location**: Before order creation in `createOrder` service
- **Error Response**: 400 Bad Request with clear message
- **Frontend Handling**: Warning banner, disabled confirm button, alert with CTA

**Code Location**:
- Backend: `src/services/order.ts` - `checkUserActiveOrders()`
- Frontend: `user-app/app/order.tsx` - Active order checks and UI handling

**API Endpoints**:
- `GET /api/client/orders/active` - Check user's active orders
- `POST /api/client/orders` - Order creation with validation

### 2. POS Payment Eligibility

**Rule**: Users are blocked from using POS if they have any failed POS payment attempts within the last 7 days. There is no longer a requirement for at least one prior successful POS payment.

**Implementation**:
- **Eligibility Criteria**:
  - No failed POS payments in the last 7 days (`paymentStatus: 'FAILED'`)
- **Check Location**: Before order creation and payment method selection
- **Error Response**: 400 Bad Request with clear message
- **Frontend Handling**: Disabled POS option, alert with alternative payment suggestion

**Code Location**:
- Backend: `src/services/order.ts` - `canUserUsePOSPayment()`
- Frontend: `user-app/app/order.tsx` - POS eligibility checks and UI handling

**API Endpoints**:
- `GET /api/client/payment/pos-eligibility` - Check POS payment eligibility
- `POST /api/client/orders` - Order creation with POS validation

## Technical Implementation

### Backend Services

#### Order Service (`src/services/order.ts`)

```typescript
// Check if user has active orders
export const checkUserActiveOrders = async (userId: string): Promise<boolean>

// Get user's active orders with details
export const getUserActiveOrders = async (userId: string)

// Check if user can use POS payment method
export const canUserUsePOSPayment = async (userId: string): Promise<boolean>
```

#### Order Controller (`src/controllers/order.ts`)

```typescript
// Check active orders endpoint
async checkActiveOrders(req: Request & { user: { id: string } }, res: Response)

// Check POS payment eligibility endpoint
async checkPOSPaymentEligibility(req: Request & { user: { id: string } }, res: Response)
```

### Frontend Implementation

#### Order Page (`user-app/app/order.tsx`)

- **Loading State**: Shows spinner while checking restrictions
- **Warning Banner**: Displays when user has active orders
- **Payment Method Disabling**: POS option disabled if not eligible
- **Confirm Button**: Disabled when active orders exist
- **User-Friendly Alerts**: Clear messages with actionable CTAs

#### Order Service (`user-app/services/order.ts`)

```typescript
// Check active orders
getActiveOrders: async () => Promise<ActiveOrdersResponse>

// Check POS payment eligibility
checkPOSPaymentEligibility: async () => Promise<POSPaymentEligibilityResponse>
```

## API Response Formats

### Active Orders Check

```json
{
  "success": true,
  "hasActiveOrders": true,
  "activeOrders": [
    {
      "id": "order_id",
      "orderId": "ORDER-001",
      "status": "PENDING",
      "deliveryAddress": "123 Main St",
      "amount": 5000,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "message": "User has active orders"
}
```

### POS Payment Eligibility

```json
{
  "success": true,
  "canUsePOS": false,
  "message": "User cannot use POS payment"
}
```

## Error Handling

### Backend Errors

- **400 Bad Request**: Business rule violations
- **401 Unauthorized**: Missing authentication
- **500 Internal Server Error**: System errors

### Frontend Error Handling

- **Graceful Degradation**: App continues to function with warnings
- **User-Friendly Messages**: Clear explanations of restrictions
- **Alternative Options**: Suggestions for alternative actions
- **Loading States**: Proper loading indicators during checks

## Testing

### Test Script

Run the business rules test:

```bash
node test-business-rules.js
```

This script tests:
- ✅ Active orders restriction
- ✅ POS payment eligibility
- ✅ Failed POS payment blocking
- ✅ Successful POS payment enabling

### Manual Testing

1. **Active Order Restriction**:
   - Create an order
   - Try to create another order
   - Verify error message and UI behavior

2. **POS Payment Eligibility**:
   - Try POS payment without successful history
   - Complete a successful POS payment
   - Verify POS becomes available
   - Fail a POS payment
   - Verify POS becomes unavailable for 30 days

## Monitoring and Logging

### Key Metrics to Track

- Active orders per user
- POS payment success/failure rates
- Business rule violation attempts
- User experience with restrictions

### Log Messages

- Order creation attempts with active orders
- POS payment eligibility checks
- Business rule violations
- User actions in response to restrictions

## Future Enhancements

### Potential Improvements

1. **Configurable Timeframes**: Make 30-day POS restriction configurable
2. **Admin Override**: Allow admins to override restrictions
3. **Analytics Dashboard**: Track business rule effectiveness
4. **User Notifications**: Proactive notifications about restrictions
5. **A/B Testing**: Test different restriction approaches

### Additional Business Rules

1. **Order Cancellation Limits**: Limit order cancellations per user
2. **Payment Method Rotation**: Encourage use of different payment methods
3. **Delivery Time Restrictions**: Limit orders during peak hours
4. **Geographic Restrictions**: Limit orders to certain areas

## Deployment Notes

### Environment Variables

No additional environment variables required for these business rules.

### Database Requirements

- Existing `Order` table with `status`, `paymentMethod`, `paymentStatus` fields
- Existing `User` table for user identification

### Migration Requirements

No database migrations required - uses existing schema.

## Support and Troubleshooting

### Common Issues

1. **False Positives**: Users incorrectly blocked from ordering
2. **POS Eligibility Issues**: Users can't use POS despite successful payments
3. **Performance**: Slow response times during restriction checks

### Debugging

1. Check application logs for business rule violations
2. Verify database queries are working correctly
3. Test API endpoints directly
4. Check frontend network requests

### Rollback Plan

If issues arise:
1. Temporarily disable business rules in code
2. Deploy hotfix
3. Investigate and fix issues
4. Re-enable business rules 