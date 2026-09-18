import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { list, create, bulkGenerate, markPaid } from "../controllers/salaryController.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", list);
router.post("/", create);
router.post("/bulk-generate", bulkGenerate);
router.post("/:id/mark-paid", markPaid);

export default router;
