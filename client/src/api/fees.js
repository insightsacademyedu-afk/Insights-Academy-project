import api from "./client";

// Fees does NOT use createResourceApi — unlike every other module so far,
// server/routes/feeRoutes.js is not a plain crudFactory resource: invoices
// have no PUT/DELETE at all (an invoice is a financial record — corrections
// happen via payments/adjustments, never an edit or delete, matching
// FeePayment's own "append-only" comment in the model), and payments only
// ever get created, never listed on their own (they're read as part of a
// single invoice's detail). So this file hand-wraps the exact five routes
// feeRoutes.js actually exposes instead of pretending it's a generic
// resource.
export const feesApi = {
  // GET /fees/invoices — {items,page,limit,total,totalPages}, same shape
  // as every other list endpoint. Supports exact filters only (student,
  // academicSession, status, invoiceType) — no free-text search, since
  // feeController.listInvoices doesn't pass searchFields to buildListQuery.
  listInvoices(params = {}) {
    return api.get("/fees/invoices", { params }).then((r) => r.data);
  },
  // GET /fees/invoices/:id — NOT a bare invoice: the backend returns
  // { invoice, payments }, matching feeController.getInvoice.
  getInvoice(id) {
    return api.get(`/fees/invoices/${id}`).then((r) => r.data);
  },
  // POST /fees/invoices — { student, academicSession, period, invoiceType,
  // dueDate, overrides? }. Omitted `overrides` fields snapshot straight
  // from the student's current feeDetails (see feeController.createInvoice).
  createInvoice(body) {
    return api.post("/fees/invoices", body).then((r) => r.data);
  },
  // POST /fees/invoices/bulk-generate — { class, section, academicSession,
  // period, dueDate }. Returns { createdCount, skippedCount, created, skipped }
  // — students already invoiced for that period are skipped, not errored.
  bulkGenerateInvoices(body) {
    return api.post("/fees/invoices/bulk-generate", body).then((r) => r.data);
  },
  // POST /fees/payments — { invoice, amount, method, reference?, notes? }.
  // Returns { invoice, payment } with the invoice's amountPaid/status
  // already recomputed server-side inside the same transaction.
  recordPayment(body) {
    return api.post("/fees/payments", body).then((r) => r.data);
  },
  // PATCH /fees/invoices/:id/waive — { reason? }. Sets status to "waived",
  // a sticky administrative excuse recomputeStatus() never overwrites
  // afterward. 409 if already waived, 400 if already fully paid (matches
  // feeController.waiveInvoice).
  waiveInvoice(id, body = {}) {
    return api.patch(`/fees/invoices/${id}/waive`, body).then((r) => r.data);
  },
  // GET /fees/students/:studentId/summary
  studentSummary(studentId) {
    return api.get(`/fees/students/${studentId}/summary`).then((r) => r.data);
  },
};
