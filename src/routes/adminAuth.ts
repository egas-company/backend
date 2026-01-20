import express from "express";
import { validate } from "../middleware/validate";
import { adminAuthController } from "../controllers/adminAuth";
import { adminAuthSchema } from "../schemas/admin";

const router = express.Router();

// Public routes for development
router.post("/signup", adminAuthController.signup);

router.post(
  "/login",
  validate(adminAuthSchema.login),
  adminAuthController.login
);

export default router;
