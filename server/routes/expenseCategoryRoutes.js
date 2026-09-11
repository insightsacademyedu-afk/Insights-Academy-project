import { Router } from "express";
import ExpenseCategory from "../models/ExpenseCategory.js";
import Expense from "../models/Expense.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createCrudController, blockDelete } from "../utils/crudFactory.js";
import { sensitiveActionRateLimiter } from "../middleware/rateLimiters.js";
import { archiveResource } from "../controllers/archiveController.js";

const router = Router();

const controller = createCrudController(ExpenseCategory, {
  searchFields: ["name"],
  exactFilters: ["status"],
  duplicateMessage: "A category with this name already exists",
  beforeDelete: async (doc) => {
    const inUse = await Expense.exists({ category: doc._id });
    if (inUse) {
      blockDelete("Cannot delete a category that has expenses recorded against it. Deactivate it instead.");
    }
  },
});

router.use(requireAuth, requireRole("admin"));

router.get("/", controller.list);
router.get("/:id", controller.getOne);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", sensitiveActionRateLimiter, archiveResource("expenseCategory"));

export default router;
