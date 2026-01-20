# Driver Assignment System

## Overview

The EGas application implements a robust driver assignment system that supports both automatic and manual driver assignment to orders. The system ensures efficient order delivery by intelligently matching the best available driver to each order.

## Assignment Types

### 1. Auto-Assignment
- **Trigger**: Automatically occurs when a new order is created
- **Logic**: Uses intelligent scoring algorithm to find the best available driver
- **Fallback**: If no suitable driver is found, order remains unassigned for manual assignment

### 2. Manual Assignment
- **Trigger**: Admin-initiated assignment through admin dashboard
- **Use Cases**: 
  - No available drivers for auto-assignment
  - Specific driver preference
  - Override auto-assignment decisions
  - Emergency situations

## Auto-Assignment Algorithm

### Driver Scoring Criteria

The system uses a weighted scoring algorithm to determine the best driver:

```typescript
const finalScore = 
  distanceScore * -0.4 +      // 40% weight, lower distance = better
  workloadScore * -0.2 +      // 20% weight, lower workload = better
  experienceScore * 0.15 +    // 15% weight, higher experience = better
  timeScore * 0.1;            // 10% weight, higher time since last order = better
```

### Scoring Components

1. **Distance Score (40% weight)**
   - Calculates distance between driver location and delivery address
   - Lower distance = higher score
   - Uses Haversine formula for accurate geographic distance

2. **Workload Score (20% weight)**
   - Based on number of active orders
   - Lower workload = higher score
   - Formula: `activeOrders * 25`

3. **Experience Score (15% weight)**
   - Based on total completed trips
   - Higher experience = higher score
   - Formula: `Math.min(100, (totalTrips / 100) * 100)`

4. **Time Score (10% weight)**
   - Time since last order assignment
   - Higher time = higher score (ensures fair distribution)
   - Formula: `Math.min(100, (hoursSinceLastOrder / 24) * 100)`

### Driver Eligibility Criteria

Drivers must meet these criteria to be considered for assignment:

- **Availability**: `isAvailable: true`
- **Active Status**: `user.isActive: true`
- **Not Blocked**: `user.isBlocked: false`
- **Location Data**: Valid `currentLat` and `currentLong`

## Implementation

### Backend Services

#### Order Service (`src/services/order.ts`)

```typescript
// Auto-assign driver to order
export const autoAssignDriver = async (
  orderId: string, 
  deliveryLat: number, 
  deliveryLong: number
): Promise<AssignmentResult>

// Manual assignment by admin
export const manualAssignDriver = async (
  orderId: string, 
  driverId: string, 
  assignedBy: string
): Promise<AssignmentResult>
```

#### Distance Utility (`src/utils/distance.ts`)

```typescript
// Find best available driver using scoring algorithm
export const findBestAvailableDriver = async (
  deliveryLat: number,
  deliveryLong: number,
  excludeDriverId?: string
): Promise<Driver | null>

// Calculate distance between two points
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number
```

### Admin API Endpoints

#### Manual Assignment
```http
POST /api/admin/orders/assign-driver
Content-Type: application/json

{
  "orderId": "order_id",
  "driverId": "driver_id"
}
```

#### Auto-Assignment
```http
POST /api/admin/orders/:id/auto-assign
```

#### Order Management
```http
GET /api/admin/orders/pending          # Get all pending orders
GET /api/admin/orders/unassigned       # Get unassigned orders
GET /api/admin/orders                  # Get all orders
```

### Response Formats

#### Assignment Result
```json
{
  "success": true,
  "driver": {
    "id": "driver_id",
    "user": {
      "firstName": "John",
      "lastName": "Driver",
      "phoneNumber": "2349061775634"
    }
  },
  "message": "Order auto-assigned to John Driver"
}
```

#### Pending Orders
```json
{
  "success": true,
  "data": [
    {
      "id": "order_id",
      "orderId": "ORDER-001",
      "customerName": "John Doe",
      "customerPhone": "2349061775633",
      "deliveryAddress": "123 Main St",
      "amount": 5000,
      "status": "PENDING",
      "createdAt": "2024-01-15T10:30:00Z",
      "assignedDriver": "John Driver"
    }
  ]
}
```

## Order Status Flow

### Assignment Process

1. **PENDING** → Order created, waiting for assignment
2. **ASSIGNED** → Driver assigned (auto or manual)
3. **ACCEPTED** → Driver accepted the order
4. **PICKED_UP** → Driver picked up the gas tank
5. **IN_TRANSIT** → Driver en route to delivery
6. **DELIVERED** → Order completed

### Assignment States

- **Unassigned**: `status: "PENDING"` and `driverId: null`
- **Assigned**: `status: "ASSIGNED"` and `driverId: "driver_id"`
- **In Progress**: `status: "ACCEPTED" | "PICKED_UP" | "IN_TRANSIT"`

## Notifications

### Driver Notifications
- **Push Notification**: When order is assigned
- **Socket Event**: Real-time order updates
- **SMS**: Optional SMS notification

### Customer Notifications
- **Push Notification**: When driver is assigned
- **Status Updates**: Real-time order status changes

## Error Handling

### Common Scenarios

1. **No Available Drivers**
   - Order remains in PENDING state
   - Admin can manually assign when drivers become available

2. **Driver Unavailable**
   - System automatically excludes unavailable drivers
   - Falls back to next best available driver

3. **Assignment Failure**
   - Logs error for debugging
   - Order remains unassigned
   - Admin notification for manual intervention

### Error Responses

```json
{
  "success": false,
  "message": "No available drivers found. Order will be assigned manually by admin."
}
```

## Monitoring and Analytics

### Key Metrics

- **Auto-assignment Success Rate**: Percentage of orders auto-assigned
- **Assignment Time**: Time from order creation to assignment
- **Driver Utilization**: Average orders per driver
- **Distance Optimization**: Average delivery distance

### Logging

```typescript
// Assignment attempts
console.log(`Order ${orderId} auto-assignment attempted:`, result);

// Manual assignments
console.log(`Order ${orderId} manually assigned to driver ${driverId} by admin ${adminId}`);

// Assignment failures
console.error("Auto-assignment failed:", error);
```

## Testing

### Test Script

Run the driver assignment test:

```bash
node test-driver-assignment.js
```

This script tests:
- ✅ Auto-assignment logic
- ✅ Manual assignment
- ✅ Driver scoring algorithm
- ✅ Order status management
- ✅ Pending/unassigned order queries

### Manual Testing

1. **Auto-Assignment Test**:
   - Create order with available drivers
   - Verify best driver is selected
   - Check assignment notifications

2. **Manual Assignment Test**:
   - Create order without available drivers
   - Manually assign specific driver
   - Verify assignment and notifications

3. **Edge Cases**:
   - No available drivers
   - Driver becomes unavailable during assignment
   - Multiple orders competing for same driver

## Configuration

### Scoring Weights

```typescript
const SCORING_WEIGHTS = {
  distance: -0.4,    // 40% weight, negative because lower is better
  workload: -0.2,    // 20% weight, negative because lower is better
  experience: 0.15,  // 15% weight
  time: 0.1          // 10% weight
};
```

### Assignment Settings

```typescript
const ASSIGNMENT_SETTINGS = {
  maxDistance: 50,           // Maximum assignment distance (km)
  maxWorkload: 3,            // Maximum active orders per driver
  assignmentTimeout: 300000, // 5 minutes timeout for assignment
  retryAttempts: 3           // Number of auto-assignment retries
};
```

## Future Enhancements

### Planned Improvements

1. **Machine Learning**: Predictive driver assignment based on historical data
2. **Real-time Optimization**: Dynamic reassignment based on traffic conditions
3. **Driver Preferences**: Allow drivers to set preferred areas
4. **Load Balancing**: Better distribution of orders across drivers
5. **Geographic Zones**: Assign drivers to specific service areas

### Advanced Features

1. **Batch Assignment**: Assign multiple orders to drivers efficiently
2. **Priority Orders**: Handle urgent orders with priority assignment
3. **Driver Scheduling**: Consider driver availability schedules
4. **Weather Conditions**: Factor in weather for assignment decisions
5. **Traffic Integration**: Real-time traffic data for route optimization

## Troubleshooting

### Common Issues

1. **Orders Not Being Assigned**
   - Check driver availability
   - Verify driver location data
   - Review assignment logs

2. **Poor Assignment Quality**
   - Review scoring weights
   - Check driver data accuracy
   - Analyze assignment patterns

3. **Assignment Delays**
   - Monitor driver response times
   - Check notification delivery
   - Review system performance

### Debug Commands

```bash
# Check available drivers
curl -X GET "http://localhost:5000/api/admin/drivers/available"

# Check pending orders
curl -X GET "http://localhost:5000/api/admin/orders/pending"

# Manual assignment
curl -X POST "http://localhost:5000/api/admin/orders/assign-driver" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "order_id", "driverId": "driver_id"}'
``` 