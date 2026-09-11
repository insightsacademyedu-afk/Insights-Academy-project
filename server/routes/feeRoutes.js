import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  listInvoices,
  getInvoice,
  createInvoice,
  bulkGenerateTuitionInvoices,
  recordPayment,
  waiveInvoice,
  studentFeeSummary,
} from "../controllers/feeController.js";

const router = Router();

// Fees are financial data — admin only, no teacher access at all.
router.use(requireAuth, requireRole("admin"));

router.get("/invoices", listInvoices);
router.get("/invoices/:id", getInvoice);
router.post("/invoices", createInvoice);
router.post("/invoices/bulk-generate", bulkGenerateTuitionInvoices);
router.patch("/invoices/:id/waive", waiveInvoice);

router.post("/payments", recordPayment);

router.get("/students/:studentId/summary", studentFeeSummary);

export default router;
