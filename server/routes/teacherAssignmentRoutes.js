import { Router } from "express";
import TeacherClassAssignment from "../models/TeacherClassAssignment.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createCrudController } from "../utils/crudFactory.js";
import { sensitiveActionRateLimiter } from "../middleware/rateLimiters.js";
import { archiveResource } from "../controllers/archiveController.js";


const router = Router();

const populatePaths = [
  { path: "teacher", select: "fullName" },
  { path: "class", select: "name" },
  { path: "section", select: "name" },
  { path: "subject", select: "name code" },
  { path: "academicSession", select: "name" },
];

const controller = createCrudController(TeacherClassAssignment, {
  exactFilters: ["status", "teacher", "class", "section", "subject", "academicSession"],
  populate: populatePaths,
  duplicateMessage: "This teacher is already assigned to this class/section/subject for this session",
});

router.use(requireAuth);

// A teacher viewing their own assignments — no admin role required, but
// scoped hard to req.user.staffId so a teacher can never query anyone else's.
router.get("/mine", async (req, res, next) => {
  try {
    if (!req.user.staffId) {
      return res.json({ items: [] });
    }
    const items = await TeacherClassAssignment.find({
      teacher: req.user.staffId, status: "active",
      ...(req.query.academicSession ? { academicSession: req.query.academicSession } : {}),
    }).populate(populatePaths);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// Everything else here is admin-only: creating/editing/removing assignments
// is how access control itself is managed, so it must be tightly restricted.
router.use(requireRole("admin"));

router.get("/", controller.list);
router.get("/:id", controller.getOne);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", sensitiveActionRateLimiter, archiveResource("teacherAssignment"));

export default router;
