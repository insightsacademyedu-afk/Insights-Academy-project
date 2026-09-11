import { Router } from "express";
import Designation from "../models/Designation.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createCrudController, blockDelete } from "../utils/crudFactory.js";
import { sensitiveActionRateLimiter } from "../middleware/rateLimiters.js";
import { archiveResource } from "../controllers/archiveController.js";

import Staff from "../models/Staff.js";

const router = Router();

const controller = createCrudController(Designation, {
  beforeDelete: async (doc) => {
    if (await Staff.exists({ designation: doc._id })) blockDelete("This record has dependent history. Deactivate it instead.");
  },
  searchFields: ["title"],
  exactFilters: ["status"],
  duplicateMessage: "This designation already exists",
});

router.use(requireAuth, requireRole("admin"));

router.get("/", controller.list);
router.get("/:id", controller.getOne);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", sensitiveActionRateLimiter, archiveResource("designation"));

export default router;
