import { Router } from "express";
import { login, logout, me, changePassword } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { loginRateLimiter, sensitiveActionRateLimiter } from "../middleware/rateLimiters.js";

const router = Router();

router.post("/login", loginRateLimiter, login);
router.post("/logout", requireAuth, logout);
router.get("/me", requireAuth, me);
router.post("/change-password", requireAuth, sensitiveActionRateLimiter, changePassword);

export default router;
