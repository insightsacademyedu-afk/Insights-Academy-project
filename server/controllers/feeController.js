import { sumMoney } from "../utils/money.js";
import mongoose from "mongoose";
import FeeInvoice, { computeInvoiceTotal } from "../models/FeeInvoice.js";
import FeePayment from "../models/FeePayment.js";
import Student from "../models/Student.js";
import StudentClassAssignment from "../models/StudentClassAssignment.js";
import { buildListQuery, paginatedResponse } from "../utils/listQuery.js";
import { nextReceiptNumber } from "../utils/counters.js";

const INVOICE_TYPES = ["tuition", "admission", "exam", "other"];
const TYPE_AMOUNT_FIELDS = { admission: "admissionFee", exam: "examFee", other: "otherFee" };

function invoiceFieldsFor(student, type, amountOverride) {
  const fields = { monthlyTuition: 0, admissionFee: 0, examFee: 0, otherFee: 0, discount: 0, scholarship: 0 };
  if (type === "tuition") {
    fields.monthlyTuition = amountOverride ?? student.feeDetails.monthlyTuition;
    fields.discount = student.feeDetails.discount;
    fields.scholarship = student.feeDetails.scholarship;
  } else {
    const field = TYPE_AMOUNT_FIELDS[type];
    fields[field] = amountOverride ?? student.feeDetails[field];
  }
  return fields;
}

// Fees is an admin-only module end to end (per spec, financial data is
// explicitly excluded from what teachers can see — see shapeForRole in
// studentController.js) so there is no teacher-scoping logic here at all.

export async function listInvoices(req, res, next) {
  try {
    const { filter, page, limit, skip, sort } = buildListQuery(req.query, {
      exactFilters: ["student", "academicSession", "status", "invoiceType"],
    });

    const [items, total] = await Promise.all([
      FeeInvoice.find(filter).populate("student", "fullName admissionNumber").sort(sort).skip(skip).limit(limit),
      FeeInvoice.countDocuments(filter),
    ]);

    res.json(paginatedResponse(items, total, page, limit));
  } catch (err) {
    next(err);
  }
}

export async function getInvoice(req, res, next) {
  try {
    const invoice = await FeeInvoice.findById(req.params.id).populate("student", "fullName admissionNumber");
    if (!invoice) return res.status(404).json({ message: "Not found" });

    const payments = await FeePayment.find({ invoice: invoice._id }).sort({ paidAt: -1 });
    res.json({ invoice, payments });
  } catch (err) {
    next(err);
  }
}

// Creates a single invoice for one student, snapshotting amounts from the
// student's current feeDetails unless explicit amounts are provided in the
// request (useful for one-off charges like a field trip fee).
export async function createInvoice(req, res, next) {
  try {
    const { student: studentId, academicSession, period, invoiceType, dueDate, overrides = {} } = req.body;

    if (!studentId || !academicSession || !period || !dueDate) {
      return res.status(400).json({ message: "student, academicSession, period and dueDate are required" });
    }

    const student = await Student.findOne({ _id: studentId, archivedAt: null });
    if (!student) return res.status(404).json({ message: "Student not found" });

    const type = invoiceType || "tuition";
    if (!INVOICE_TYPES.includes(type)) return res.status(400).json({ message: "Invalid invoice type" });
    const defaults = invoiceFieldsFor(student, type);
    const fields = {
      monthlyTuition: overrides.monthlyTuition ?? defaults.monthlyTuition,
      admissionFee: overrides.admissionFee ?? defaults.admissionFee,
      examFee: overrides.examFee ?? defaults.examFee,
      otherFee: overrides.otherFee ?? defaults.otherFee,
      discount: overrides.discount ?? defaults.discount,
      scholarship: overrides.scholarship ?? defaults.scholarship,
    };

    const invoice = new FeeInvoice({
      student: studentId,
      academicSession,
      period,
      invoiceType: invoiceType || "tuition",
      dueDate,
      ...fields,
      totalAmount: computeInvoiceTotal(fields),
    });
    // A fresh invoice can already need a non-default status (fully
    // discounted -> "paid"; a backdated dueDate -> "overdue"), and
    // recomputeStatus() is the single formula for that everywhere else
    // (see recordPayment below) — creation shouldn't rely on the schema's
    // "unpaid" default instead.
    invoice.recomputeStatus();
    await invoice.save();

    res.status(201).json(invoice);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "An invoice for this student/period/type already exists" });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
}

// Bulk-generates tuition invoices for every active student in a class +
// section, for a given period — the normal monthly billing run. Skips
// (rather than fails) students who already have an invoice for that
// period, and reports what happened so the admin can see partial results.
export async function bulkGenerateTuitionInvoices(req, res, next) {
  try {
    const { class: classId, section, academicSession, period, dueDate, invoiceType = "tuition", amountOverride } = req.body;
    if (!classId || !section || !academicSession || !period || !dueDate) {
      return res.status(400).json({ message: "class, section, academicSession, period and dueDate are required" });
    }
    if (!INVOICE_TYPES.includes(invoiceType)) return res.status(400).json({ message: "Invalid invoice type" });
    const hasAmountOverride = amountOverride !== undefined && amountOverride !== "";
    const overrideAmount = hasAmountOverride ? Number(amountOverride) : undefined;
    if (hasAmountOverride && (!Number.isFinite(overrideAmount) || overrideAmount < 0)) {
      return res.status(400).json({ message: "Amount must be a valid number of 0 or more" });
    }

    const assignments = await StudentClassAssignment.find({
      class: classId,
      section,
      academicSession,
      status: "active",
      archivedAt: null,
    }).populate("student");

    const created = [];
    const skipped = [];

    for (const assignment of assignments) {
      const student = assignment.student;
      if (!student || student.status !== "active" || student.archivedAt) {
        skipped.push({ student: assignment.student, reason: "student not active" });
        continue;
      }

      const fields = invoiceFieldsFor(student, invoiceType, overrideAmount);

      try {
        const invoice = new FeeInvoice({
          student: student._id,
          academicSession,
          period,
          invoiceType,
          dueDate,
          ...fields,
          totalAmount: computeInvoiceTotal(fields),
        });
        invoice.recomputeStatus(); // same reasoning as createInvoice() above
        await invoice.save();
        created.push(invoice);
      } catch (err) {
        if (err.code === 11000) {
          skipped.push({ student: student._id, reason: `${invoiceType} invoice already exists for this period` });
        } else {
          throw err;
        }
      }
    }

    res.status(201).json({ createdCount: created.length, skippedCount: skipped.length, created, skipped });
  } catch (err) {
    next(err);
  }
}

// Records a payment against an invoice, transactionally updating the
// invoice's amountPaid/status so the two can never drift apart. Requires
// a replica-set MongoDB.
export async function recordPayment(req, res, next) {
  let session;
  try {
    session = await mongoose.startSession();
    const { invoice: invoiceId, amount, method, reference, notes } = req.body;

    if (!invoiceId || typeof amount !== "number" || !Number.isFinite(amount) || !amount || !method) {
      return res.status(400).json({ message: "invoice, amount and method are required" });
    }
    if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7) return res.status(400).json({ message: "amount must have at most two decimal places" });
    if (amount <= 0 && method !== "adjustment") {
      return res.status(400).json({ message: "amount must be positive unless method is 'adjustment'" });
    }

    let result;
    await session.withTransaction(async () => {
      const invoice = await FeeInvoice.findById(invoiceId).session(session);
      if (!invoice) {
        const err = new Error("Invoice not found");
        err.status = 404;
        throw err;
      }

      if (invoice.status === "waived") throw Object.assign(new Error("Cannot record payment against a waived invoice"), { status: 409 });
      const newAmountPaid = sumMoney(invoice.amountPaid, amount);
      if (newAmountPaid < 0) throw Object.assign(new Error("Adjustment cannot exceed payments received"), { status: 400 });
      if (newAmountPaid > invoice.totalAmount) {
        const err = new Error(
          `Payment of ${amount} would exceed the remaining balance of ${invoice.totalAmount - invoice.amountPaid}`
        );
        err.status = 400;
        throw err;
      }

      invoice.amountPaid = newAmountPaid;
      invoice.recomputeStatus();
      await invoice.save({ session });

      const receiptNumber = await nextReceiptNumber(session);

      const [payment] = await FeePayment.create(
        [
          {
            invoice: invoice._id,
            student: invoice.student,
            amount,
            method,
            reference,
            notes,
            receiptNumber,
            receivedBy: req.user._id,
          },
        ],
        { session }
      );

      result = { invoice, payment };
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    next(err);
  } finally {
    await session?.endSession();
  }
}

// Marks an invoice "waived" — an administrative excuse of the remaining
// balance (scholarship exception, hardship case, write-off), distinct from
// a payment. Per FeeInvoice.recomputeStatus()'s own comment, "waived" is a
// manual, sticky state that payment recomputation never overwrites, but
// until now nothing could ever set it in the first place except a direct
// DB write — flagged as a gap in Phase 9 (session 3) and Phase 5 frontend
// (session 5). This is that missing route.
export async function waiveInvoice(req, res, next) {
  try {
    const { reason } = req.body;
    const invoice = await FeeInvoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Not found" });

    if (invoice.status === "waived") {
      return res.status(409).json({ message: "Invoice is already waived" });
    }
    if (invoice.status === "paid") {
      return res.status(400).json({ message: "Invoice is already fully paid — nothing to waive" });
    }

    invoice.status = "waived";
    if (reason) {
      invoice.notes = invoice.notes ? `${invoice.notes}\nWaived: ${reason}` : `Waived: ${reason}`;
    }
    await invoice.save();

    res.json(invoice);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
}

// Outstanding-balance summary for a student — used by the student profile
// page and the Phase 9 dashboard.
export async function studentFeeSummary(req, res, next) {
  try {
    const { studentId } = req.params;

    const invoices = await FeeInvoice.find({ student: studentId });
    const totalBilled = invoices.reduce((sum, inv) => sumMoney(sum, inv.totalAmount), 0);
    const totalPaid = invoices.reduce((sum, inv) => sumMoney(sum, inv.amountPaid), 0);

    res.json({
      studentId,
      totalBilled,
      totalPaid,
      outstanding: invoices.reduce((sum, inv) => sumMoney(sum, inv.status === "waived" ? 0 : Math.max(0, sumMoney(inv.totalAmount, -inv.amountPaid))), 0),
      invoiceCount: invoices.length,
      unpaidCount: invoices.filter((i) => ["unpaid", "overdue", "partially_paid"].includes(i.status)).length,
    });
  } catch (err) {
    next(err);
  }
}
