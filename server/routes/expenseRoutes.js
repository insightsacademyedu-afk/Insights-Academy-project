import { Router } from "express";
import Expense from "../models/Expense.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createCrudController } from "../utils/crudFactory.js";
import { sensitiveActionRateLimiter } from "../middleware/rateLimiters.js";
import { archiveResource } from "../controllers/archiveController.js";

const router = Router();

const controller = createCrudController(Expense, {
  exactFilters: ["category", "sourceSalaryPayment"],
  populate: ["category", "recordedBy"],
});

// An expense auto-created by markPaid() must stay in sync with its salary
// record — editing or deleting it directly here would desync the two.
async function blockIfSalaryLinked(req, res, next) {
  try {
    const expense = await Expense.findById(req.params.id);
    if (expense?.sourceSalaryPayment) {
      return res.status(409).json({
        message: "This expense was generated from a salary payment and can't be edited or deleted directly.",
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

// Expense.recordedBy is required but is an audit field, not something the
// client should be trusted to set — it must come from the authenticated
// admin, not the request body (the generic CRUD factory otherwise passes
// req.body straight through to Model.create with no such field present,
// which always failed validation).
function stampRecordedBy(req, res, next) {
  const { sourceSalaryPayment, recordedBy, ...fields } = req.body;
  req.body = { ...fields, recordedBy: req.user._id };
  next();
}

router.use(requireAuth, requireRole("admin"));

router.get("/", controller.list);
router.get("/:id", controller.getOne);
router.post("/", stampRecordedBy, controller.create);
router.put("/:id", blockIfSalaryLinked, (req, res, next) => {
  delete req.body.sourceSalaryPayment;
  delete req.body.recordedBy;
  next();
}, controller.update);
router.delete("/:id", sensitiveActionRateLimiter, archiveResource("expense"));

export default router;
