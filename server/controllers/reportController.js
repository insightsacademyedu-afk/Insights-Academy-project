import { sumMoney } from "../utils/money.js";
import Student from "../models/Student.js";
import FeeInvoice from "../models/FeeInvoice.js";
import FeePayment from "../models/FeePayment.js";
import Expense from "../models/Expense.js";
import { buildListQuery } from "../utils/listQuery.js";

// Minimal, dependency-free CSV writer. Good enough for admin exports;
// swap for a library (e.g. json2csv) later if formatting needs grow
// (quoted multiline fields, custom delimiters, etc.).
function toCsv(rows, columns) {
  const escape = (val) => {
    if (typeof val === "number" && Number.isFinite(val)) return String(val); // signed financial amounts stay numeric in spreadsheets

    let s = val === null || val === undefined ? "" : String(val);
    if (/^[\s]*[=+@-]|^[\t\r\n]/.test(s)) s = "\'" + s;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => escape(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => escape(c.value(row))).join(","));
  return [header, ...lines].join("\n");
}

function sendCsv(res, filename, csv) {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

// Admin-only, per route guard. Financial reports are explicitly
// admin-only per spec; teachers get their own scoped views via the
// regular list endpoints, not through this bulk-export surface.

export async function studentsReport(req, res, next) {
  try {
    const { filter } = buildListQuery(req.query, {
      searchFields: ["fullName", "admissionNumber"],
      exactFilters: ["status", "gender"],
    });
    filter.archivedAt = null;

    const students = await Student.find(filter).populate("guardian");

    if (req.query.format === "csv") {
      const csv = toCsv(students, [
        { label: "Admission #", value: (s) => s.admissionNumber },
        { label: "Full Name", value: (s) => s.fullName },
        { label: "Father Name", value: (s) => s.fatherName },
        { label: "Gender", value: (s) => s.gender },
        { label: "Status", value: (s) => s.status },
        { label: "Guardian Name", value: (s) => s.guardian?.fullName || "" },
        { label: "Guardian Phone", value: (s) => s.guardian?.primaryPhone || "" },
      ]);
      return sendCsv(res, "students-report.csv", csv);
    }

    res.json({ items: students, total: students.length });
  } catch (err) {
    next(err);
  }
}

export async function feeCollectionReport(req, res, next) {
  try {
    const { from, to, format } = req.query;
    const filter = {};
    if (from || to) {
      filter.paidAt = {};
      if (from) filter.paidAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        if (/^\d{4}-\d{2}-\d{2}$/.test(to)) end.setUTCHours(23, 59, 59, 999);
        filter.paidAt.$lte = end;
      }
    }

    const payments = await FeePayment.find(filter).populate("student", "fullName admissionNumber").sort({ paidAt: -1 });

    if (format === "csv") {
      const csv = toCsv(payments, [
        { label: "Receipt #", value: (p) => p.receiptNumber },
        { label: "Date", value: (p) => p.paidAt.toISOString().slice(0, 10) },
        { label: "Student", value: (p) => p.student?.fullName || "" },
        { label: "Admission #", value: (p) => p.student?.admissionNumber || "" },
        { label: "Amount (PKR)", value: (p) => p.amount },
        { label: "Method", value: (p) => p.method },
      ]);
      return sendCsv(res, "fee-collection-report.csv", csv);
    }

    const total = payments.reduce((sum, p) => sumMoney(sum, p.amount), 0);
    res.json({ items: payments, total, count: payments.length });
  } catch (err) {
    next(err);
  }
}

export async function outstandingFeesReport(req, res, next) {
  try {
    const invoices = await FeeInvoice.find({
      status: { $in: ["unpaid", "partially_paid", "overdue"] },
    }).populate("student", "fullName admissionNumber");

    if (req.query.format === "csv") {
      const csv = toCsv(invoices, [
        { label: "Student", value: (i) => i.student?.fullName || "" },
        { label: "Admission #", value: (i) => i.student?.admissionNumber || "" },
        { label: "Period", value: (i) => i.period },
        { label: "Total (PKR)", value: (i) => i.totalAmount },
        { label: "Paid (PKR)", value: (i) => i.amountPaid },
        { label: "Outstanding (PKR)", value: (i) => sumMoney(i.totalAmount, -i.amountPaid) },
        { label: "Status", value: (i) => i.status },
        { label: "Due Date", value: (i) => i.dueDate.toISOString().slice(0, 10) },
      ]);
      return sendCsv(res, "outstanding-fees-report.csv", csv);
    }

    const totalOutstanding = invoices.reduce((sum, i) => sumMoney(sum, i.totalAmount, -i.amountPaid), 0);
    res.json({ items: invoices, totalOutstanding, count: invoices.length });
  } catch (err) {
    next(err);
  }
}

export async function expensesReport(req, res, next) {
  try {
    const { from, to, format } = req.query;
    const filter = { archivedAt: null };
    if (from || to) {
      filter.expenseDate = {};
      if (from) filter.expenseDate.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        if (/^\d{4}-\d{2}-\d{2}$/.test(to)) end.setUTCHours(23, 59, 59, 999);
        filter.expenseDate.$lte = end;
      }
    }

    const expenses = await Expense.find(filter).populate("category", "name").sort({ expenseDate: -1 });

    if (format === "csv") {
      const csv = toCsv(expenses, [
        { label: "Date", value: (e) => e.expenseDate.toISOString().slice(0, 10) },
        { label: "Category", value: (e) => e.category?.name || "" },
        { label: "Amount (PKR)", value: (e) => e.amount },
        { label: "Description", value: (e) => e.description },
      ]);
      return sendCsv(res, "expenses-report.csv", csv);
    }

    const total = expenses.reduce((sum, e) => sumMoney(sum, e.amount), 0);
    res.json({ items: expenses, total, count: expenses.length });
  } catch (err) {
    next(err);
  }
}
