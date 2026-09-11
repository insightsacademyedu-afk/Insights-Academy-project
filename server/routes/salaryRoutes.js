import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { list, create, markPaid } from "../controllers/salaryController.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", list);
router.post("/", create);
router.post("/:id/mark-paid", markPaid);

export default router;
