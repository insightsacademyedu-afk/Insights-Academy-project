import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { adminSummary, teacherSummary, gradeDistribution } from "../controllers/dashboardController.js";

const router = Router();

router.use(requireAuth);

router.get("/admin-summary", requireRole("admin"), adminSummary);
router.get("/teacher-summary", teacherSummary); // scoped to req.user inside the controller
router.get("/tests/:testId/grade-distribution", gradeDistribution); // ownership checked inside

export default router;
