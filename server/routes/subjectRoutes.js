import { Router } from "express";
import Subject from "../models/Subject.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createCrudController, blockDelete } from "../utils/crudFactory.js";
import { sensitiveActionRateLimiter } from "../middleware/rateLimiters.js";
import { archiveResource } from "../controllers/archiveController.js";

import TeacherClassAssignment from "../models/TeacherClassAssignment.js";
import Test from "../models/Test.js";

const router = Router();

const controller = createCrudController(Subject, {
  beforeDelete: async (doc) => {
    if (await TeacherClassAssignment.exists({ subject: doc._id }) || await Test.exists({ subject: doc._id })) blockDelete("This record has dependent history. Deactivate it instead.");
  },
  searchFields: ["name", "code"],
  exactFilters: ["status"],
  duplicateMessage: "A subject with this code already exists",
});

router.use(requireAuth, requireRole("admin"));

router.get("/", controller.list);
router.get("/:id", controller.getOne);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", sensitiveActionRateLimiter, archiveResource("subject"));

export default router;
