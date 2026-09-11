import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { create, list, getOne, retryFailed, mine } from "../controllers/notificationController.js";

const router = Router();

router.use(requireAuth);

// Any authenticated user can check their own in-app notifications.
router.get("/mine", mine);

// Sending announcements is admin-only.
router.use(requireRole("admin"));

router.post("/", create);
router.get("/", list);
router.get("/:id", getOne);
router.post("/retry-failed", retryFailed);

export default router;
