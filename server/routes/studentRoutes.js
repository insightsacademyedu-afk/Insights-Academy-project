import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { requireStudentAccess } from "../utils/teacherScope.js";
import { list, getOne, create, update, enroll, remove } from "../controllers/studentController.js";
import { sensitiveActionRateLimiter } from "../middleware/rateLimiters.js";
import { archiveResource } from "../controllers/archiveController.js";

const router = Router();

router.use(requireAuth);

// Both admin and staff can list — the controller itself scopes staff
// down to only their assigned students, rather than a route-level block.
router.get("/", list);

// Single-student routes are guarded by requireStudentAccess, which
// enforces the exact rule from the spec: a teacher hitting a student ID
// outside their assignment gets 403, no matter how they got that ID.
router.get("/:id", requireStudentAccess("id"), getOne);

// Everything that creates/modifies student records is admin-only.
router.use(requireRole("admin"));

router.post("/", create);
router.put("/:id", update);
router.post("/:id/enroll", enroll);
router.delete("/:id", sensitiveActionRateLimiter, archiveResource("student"));

export default router;
