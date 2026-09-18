import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/settingsController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);
router.get("/", getSettings);
router.put("/", requireRole("admin"), updateSettings);
export default router;
