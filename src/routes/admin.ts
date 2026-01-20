import express from "express";
import { authenticate, authorize } from "../middleware/auth";
import { adminController } from "../controllers/admin";
import { UserRole } from "../types/user";
const router = express.Router();

// Apply authentication and admin authorization
router.use(authenticate, authorize([UserRole.ADMIN]));

// Driver management
router.get("/drivers/available", adminController.getAvailableDrivers);
router.get("/drivers", adminController.getDrivers);
router.get("/drivers/:id", adminController.getDriverById);
router.get("/drivers/:id/toggle-status", adminController.toggleDriverStatus);
router.post("/drivers", adminController.createDriver);
router.put("/drivers/:id", adminController.updateDriver);
router.delete("/drivers/:id", adminController.deleteDriver);

// Order management
router.get("/orders", adminController.getOrders);
router.get("/orders/pending", adminController.getPendingOrders);
router.get("/orders/unassigned", adminController.getUnassignedOrders);
router.post("/orders/assign-driver", adminController.assignDriver);
router.post("/orders/:id/auto-assign", adminController.autoAssignOrder);

// Tank sizes management
router.get("/tank-sizes", adminController.getTankSizes);
router.post("/tank-sizes", adminController.createTankSize);
router.put("/tank-sizes/:id", adminController.updateTankSize);

// Customer management
router.get("/customers", adminController.getCustomers);
router.get("/customers/:id", adminController.getCustomerDetails);
router.get("/customers/:id/orders", adminController.getCustomerOrders);
router.patch("/customers/:id", adminController.updateCustomer);
router.delete("/customers/:id", adminController.deleteCustomer);

// Delivery personnel
router.get("/delivery-personnel", adminController.getDeliveryPersonnel);

// Order Management
router.get("/orders/:id", adminController.getOrderDetails);
router.post("/orders/:id/cancel", adminController.cancelOrder);
router.delete("/orders/:id/delete", adminController.deleteOrder);

export default router;
