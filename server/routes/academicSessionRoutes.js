import { Router } from "express";
import AcademicSession from "../models/AcademicSession.js";
import Class from "../models/Class.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createCrudController, blockDelete } from "../utils/crudFactory.js";
import { sensitiveActionRateLimiter } from "../middleware/rateLimiters.js";
import { archiveResource } from "../controllers/archiveController.js";

const router = Router();

const controller = createCrudController(AcademicSession, {
  searchFields: ["name"],
  exactFilters: ["status", "isCurrent"],
  duplicateMessage: "A session with this name already exists",
  beforeDelete: async (doc) => {
    const inUse = await Class.exists({ academicSession: doc._id });
    if (inUse) {
      blockDelete("Cannot delete a session that has classes attached to it. Archive it instead.");
    }
  },
});

router.use(requireAuth, requireRole("admin"));

router.get("/", controller.list);
router.get("/:id", controller.getOne);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", sensitiveActionRateLimiter, archiveResource("academicSession"));

export default router;
