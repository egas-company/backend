import express, { RequestHandler } from "express";
import { tankSizeController } from "../controllers/tankSize";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { tankSizeSchema } from "../schemas/tankSize";
import { UserRole } from "../types/user";

const router = express.Router();

// Public route for getting active tank sizes
router.get("/", tankSizeController.getAllTankSizes as RequestHandler);

// Admin routes
router.use(authenticate, authorize([UserRole.ADMIN]));

router.post(
  "/",
  validate(tankSizeSchema.create),
  tankSizeController.createTankSize as RequestHandler
);

router.put(
  "/:id",
  validate(tankSizeSchema.update),
  tankSizeController.updateTankSize as RequestHandler
);

router.delete("/:id", tankSizeController.deleteTankSize as RequestHandler);

export default router;
