import app from "../app.js";
import SalaryPayment from "../models/SalaryPayment.js";
import Expense from "../models/Expense.js";
import ExpenseCategory from "../models/ExpenseCategory.js";
import Staff from "../models/Staff.js";
import { createAdminSession, withCsrf } from "./helpers/authHelpers.js";

async function makeStaff(overrides = {}) {
  return Staff.create({
    fullName: overrides.fullName || "Salaried Staff",
    basicSalary: overrides.basicSalary ?? 50000,
    status: "active",
  });
}

async function makeCategory(overrides = {}) {
  return ExpenseCategory.create({
    name: overrides.name || `Category-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  });
}

describe("Phase 7 — Expenses & Salaries", () => {
  test("creating a salary record: netAmount matches base + bonuses - deductions", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const staff = await makeStaff({ basicSalary: 50000 });

    const res = await withCsrf(
      agent.post("/api/salaries").send({ staff: staff._id, period: "2026-01", bonuses: 5000, deductions: 2000 }),
      csrfToken
    );

    expect(res.status).toBe(201);
    expect(res.body.baseAmount).toBe(50000);
    expect(res.body.netAmount).toBe(53000); // 50000 + 5000 - 2000
  });

  test("a second salary record for the same staff/period fails with 409", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const staff = await makeStaff();

    const first = await withCsrf(agent.post("/api/salaries").send({ staff: staff._id, period: "2026-02" }), csrfToken);
    expect(first.status).toBe(201);

    const second = await withCsrf(agent.post("/api/salaries").send({ staff: staff._id, period: "2026-02" }), csrfToken);
    expect(second.status).toBe(409);
  });

  test("creating a salary record with a fake staff id is rejected with 404 (checked at controller level)", async () => {
    const { agent, csrfToken } = await createAdminSession(app);

    const res = await withCsrf(
      agent.post("/api/salaries").send({ staff: "64b000000000000000000000", period: "2026-01" }),
      csrfToken
    );

    expect(res.status).toBe(404);
  });

  test("mark-paid creates exactly one linked Expense, and sets status/paidAt/paidBy", async () => {
    const { agent, csrfToken, user } = await createAdminSession(app);
    const staff = await makeStaff({ basicSalary: 30000 });
    const category = await makeCategory();

    const salaryRes = await withCsrf(agent.post("/api/salaries").send({ staff: staff._id, period: "2026-03" }), csrfToken);
    const salaryId = salaryRes.body._id;

    const paidRes = await withCsrf(
      agent.post(`/api/salaries/${salaryId}/mark-paid`).send({ expenseCategory: category._id }),
      csrfToken
    );

    expect(paidRes.status).toBe(200);
    expect(paidRes.body.salary.status).toBe("paid");
    expect(paidRes.body.salary.paidAt).toBeTruthy();
    expect(String(paidRes.body.salary.paidBy)).toBe(String(user._id));
    expect(paidRes.body.expense.sourceSalaryPayment).toBe(salaryId);
    expect(paidRes.body.expense.amount).toBe(30000);

    expect(await Expense.countDocuments({ sourceSalaryPayment: salaryId })).toBe(1);
  });

  test("calling mark-paid a second time on the same record fails with 409 (not double-paid, not double-expensed)", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const staff = await makeStaff();
    const category = await makeCategory();

    const salaryRes = await withCsrf(agent.post("/api/salaries").send({ staff: staff._id, period: "2026-04" }), csrfToken);
    const salaryId = salaryRes.body._id;

    const first = await withCsrf(
      agent.post(`/api/salaries/${salaryId}/mark-paid`).send({ expenseCategory: category._id }),
      csrfToken
    );
    expect(first.status).toBe(200);

    const second = await withCsrf(
      agent.post(`/api/salaries/${salaryId}/mark-paid`).send({ expenseCategory: category._id }),
      csrfToken
    );
    expect(second.status).toBe(409);

    expect(await Expense.countDocuments({ sourceSalaryPayment: salaryId })).toBe(1);
  });

  test("an expense referencing a fake category id is rejected with 400, not silently created", async () => {
    const { agent, csrfToken } = await createAdminSession(app);

    const res = await withCsrf(
      agent.post("/api/expenses").send({ category: "64b000000000000000000000", amount: 100 }),
      csrfToken
    );

    expect(res.status).toBe(400);
    expect(await Expense.countDocuments({})).toBe(0);
  });

  test("attempting to edit or delete an auto-generated expense directly fails with 409", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const staff = await makeStaff();
    const category = await makeCategory();

    const salaryRes = await withCsrf(agent.post("/api/salaries").send({ staff: staff._id, period: "2026-05" }), csrfToken);
    const paidRes = await withCsrf(
      agent.post(`/api/salaries/${salaryRes.body._id}/mark-paid`).send({ expenseCategory: category._id }),
      csrfToken
    );
    const expenseId = paidRes.body.expense._id;

    const editRes = await withCsrf(agent.put(`/api/expenses/${expenseId}`).send({ amount: 999 }), csrfToken);
    expect(editRes.status).toBe(409);

    const deleteRes = await withCsrf(agent.delete(`/api/expenses/${expenseId}`).send({ adminPassword: "Password123!", reason: "Incorrect expense" }), csrfToken);
    expect(deleteRes.status).toBe(409);
  });

  test("archiving an ExpenseCategory keeps expenses intact", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const category = await makeCategory();

    const expenseRes = await withCsrf(
      agent.post("/api/expenses").send({ category: category._id, amount: 250, description: "Supplies" }),
      csrfToken
    );
    expect(expenseRes.status).toBe(201);

    const deleteRes = await withCsrf(agent.delete(`/api/expense-categories/${category._id}`).send({ adminPassword: "Password123!", reason: "Category retired" }), csrfToken);
    expect(deleteRes.status).toBe(200);

    expect(await ExpenseCategory.countDocuments({ _id: category._id })).toBe(1);
    expect(await Expense.countDocuments({ category: category._id })).toBe(1);
    expect((await agent.get(`/api/expense-categories/${category._id}`)).status).toBe(404);
  });

  test("a plain, non-linked expense can be edited and archived", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const category = await makeCategory();

    const expenseRes = await withCsrf(
      agent.post("/api/expenses").send({ category: category._id, amount: 100, description: "Stationery" }),
      csrfToken
    );
    const expenseId = expenseRes.body._id;

    const editRes = await withCsrf(agent.put(`/api/expenses/${expenseId}`).send({ amount: 150 }), csrfToken);
    expect(editRes.status).toBe(200);
    expect(editRes.body.amount).toBe(150);

    const deleteRes = await withCsrf(agent.delete(`/api/expenses/${expenseId}`).send({ adminPassword: "Password123!", reason: "Entered by mistake" }), csrfToken);
    expect(deleteRes.status).toBe(200);
    expect((await agent.get(`/api/expenses/${expenseId}`)).status).toBe(404);
  });
});
