import { Router, raw } from "express";
import { createBackup, inspectBackup, restoreBackup } from "../controllers/backupController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { sensitiveActionRateLimiter } from "../middleware/rateLimiters.js";

const router = Router();
router.use(requireAuth, requireRole("admin"));
router.post("/create", sensitiveActionRateLimiter, createBackup);
router.post("/inspect", raw({ type: "application/octet-stream", limit: "250mb" }), inspectBackup);
router.post("/restore", sensitiveActionRateLimiter, raw({ type: "application/octet-stream", limit: "250mb" }), restoreBackup);
export default router;
