import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { sensitiveActionRateLimiter } from "../middleware/rateLimiters.js";
import { listArchive, restoreArchive } from "../controllers/archiveController.js";

const router = Router();
router.use(requireAuth, requireRole("admin"));
router.get("/", listArchive);
router.post("/:id/restore", sensitiveActionRateLimiter, restoreArchive);
export default router;
