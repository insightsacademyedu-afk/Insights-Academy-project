import { Router } from "express";
import SalaryPayment from "../models/SalaryPayment.js";
import Staff from "../models/Staff.js";
import TeacherClassAssignment from "../models/TeacherClassAssignment.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { sensitiveActionRateLimiter } from "../middleware/rateLimiters.js";
import { createCrudController, blockDelete } from "../utils/crudFactory.js";
import { createLogin, resetPassword, revokeLogin } from "../controllers/staffController.js";
import { archiveResource } from "../controllers/archiveController.js";

const router = Router();

const controller = createCrudController(Staff, {
  searchFields: ["fullName", "email", "phone"],
  exactFilters: ["status", "designation"],
  populate: "designation",
  duplicateMessage: "A conflicting staff record already exists",
  beforeDelete: async (doc) => {
    const hasAssignments = await TeacherClassAssignment.exists({ teacher: doc._id });
    if (hasAssignments || doc.user || await SalaryPayment.exists({ staff: doc._id })) {
      blockDelete("Cannot delete a staff member with class assignments. Deactivate instead.");
    }
  },
});

router.use(requireAuth, requireRole("admin"));

router.get("/", controller.list);
router.get("/:id", controller.getOne);
const protectLink = (req, res, next) => { delete req.body.user; next(); };
router.post("/", protectLink, controller.create);
router.put("/:id", protectLink, controller.update);
router.delete("/:id", sensitiveActionRateLimiter, archiveResource("staff"));

router.post("/:id/create-login", sensitiveActionRateLimiter, createLogin);
router.post("/:id/reset-password", sensitiveActionRateLimiter, resetPassword);
router.post("/:id/revoke-login", sensitiveActionRateLimiter, revokeLogin);

export default router;
