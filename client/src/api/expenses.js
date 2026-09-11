import { createResourceApi } from "./resource";

// Unlike salaries, server/routes/expenseRoutes.js DOES expose a full
// PUT/DELETE — but both are guarded server-side by blockIfSalaryLinked,
// which 409s if the expense's sourceSalaryPayment is set (an
// auto-generated expense must stay in sync with its salary record, so
// it can only be corrected by correcting the salary, not edited
// directly). That guard is enforced by the backend, not duplicated here
// — Salaries.jsx simply doesn't render edit/delete actions for expenses
// with a `sourceSalaryPayment`, and a manually-created expense's row
// still calls plain update()/remove() below.
//
// One gap worth flagging: POST /expenses goes straight through the
// generic crudFactory (Model.create(req.body) — see expenseRoutes.js),
// which means nothing sets `recordedBy` server-side the way
// salaryController.markPaid does for its own auto-generated expense.
// The caller must include `recordedBy` in the create body itself
// (Expense.recordedBy is `required: true`) — Salaries.jsx's "New
// expense" form fills it in from the logged-in admin's own user id via
// useAuth(), it isn't picked from a dropdown.
export const expensesApi = createResourceApi("/expenses");
