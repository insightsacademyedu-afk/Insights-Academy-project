import api from "./client";

// Salaries does NOT use createResourceApi — server/routes/salaryRoutes.js
// exposes exactly three routes (list/create/mark-paid), no PUT/DELETE at
// all. A salary record is never edited or deleted once created — it's
// either still pending (waiting to be paid) or paid (locked, since paying
// it also writes a linked Expense atomically in the same transaction —
// see salaryController.markPaid). Correcting a mistake means the admin
// creates a fresh record for the period, same philosophy as FeeInvoice/
// FeePayment being append-only.
export const salariesApi = {
  // GET /salaries — {items,page,limit,total,totalPages}. Exact filters
  // only: staff, period, status (salaryController.list's buildListQuery
  // call has no searchFields).
  list(params = {}) {
    return api.get("/salaries", { params }).then((r) => r.data);
  },
  // POST /salaries — { staff, period, baseAmount?, bonuses?, deductions?,
  // notes? }. baseAmount defaults to the staff member's current
  // basicSalary if omitted (see salaryController.create). netAmount is
  // always computed server-side via computeNetSalary — never send it.
  create(body) {
    return api.post("/salaries", body).then((r) => r.data);
  },
  // POST /salaries/:id/mark-paid — { expenseCategory } (required — the
  // linked Expense needs a category to file under). Returns
  // { salary, expense }, both already reflecting the paid state. Runs
  // inside a transaction server-side, so this either fully succeeds or
  // leaves the salary record untouched — never a salary marked paid with
  // no matching expense or vice versa.
  markPaid(id, body) {
    return api.post(`/salaries/${id}/mark-paid`, body).then((r) => r.data);
  },
};
