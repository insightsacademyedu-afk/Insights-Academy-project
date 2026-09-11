import { Router } from "express";
import Section from "../models/Section.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createCrudController, blockDelete } from "../utils/crudFactory.js";
import { sensitiveActionRateLimiter } from "../middleware/rateLimiters.js";
import { archiveResource } from "../controllers/archiveController.js";

import StudentClassAssignment from "../models/StudentClassAssignment.js";
import TeacherClassAssignment from "../models/TeacherClassAssignment.js";
import Test from "../models/Test.js";

const router = Router();

// Sections aren't referenced by anything yet at this phase (students arrive
// in Phase 4) so no beforeDelete guard is needed here yet — add one in
// Phase 4 once StudentClassAssignment exists.
const controller = createCrudController(Section, {
  beforeDelete: async (doc) => {
    if (await StudentClassAssignment.exists({ section: doc._id }) || await TeacherClassAssignment.exists({ section: doc._id }) || await Test.exists({ section: doc._id })) blockDelete("This record has dependent history. Deactivate it instead.");
  },
  searchFields: ["name"],
  exactFilters: ["status", "class"],
  populate: { path: "class", populate: "academicSession" },
  duplicateMessage: "This section already exists for the selected class",
});

router.use(requireAuth, requireRole("admin"));

router.get("/", controller.list);
router.get("/:id", controller.getOne);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", sensitiveActionRateLimiter, archiveResource("section"));

export default router;
