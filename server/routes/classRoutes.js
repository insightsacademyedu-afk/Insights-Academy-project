import { Router } from "express";
import Class from "../models/Class.js";
import Section from "../models/Section.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createCrudController, blockDelete } from "../utils/crudFactory.js";
import { sensitiveActionRateLimiter } from "../middleware/rateLimiters.js";
import { archiveResource } from "../controllers/archiveController.js";

const router = Router();

const controller = createCrudController(Class, {
  searchFields: ["name"],
  exactFilters: ["status", "academicSession"],
  populate: "academicSession",
  duplicateMessage: "This class already exists for the selected session",
  beforeDelete: async (doc) => {
    const inUse = await Section.exists({ class: doc._id });
    if (inUse) {
      blockDelete("Cannot delete a class that has sections attached to it. Deactivate it instead.");
    }
  },
});

router.use(requireAuth, requireRole("admin"));

router.get("/", controller.list);
router.get("/:id", controller.getOne);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", sensitiveActionRateLimiter, archiveResource("class"));

export default router;
