import mongoose from "mongoose";
import SalaryPayment, { computeNetSalary } from "../models/SalaryPayment.js";
import Expense from "../models/Expense.js";
import Staff from "../models/Staff.js";
import { buildListQuery, paginatedResponse } from "../utils/listQuery.js";

export async function list(req, res, next) {
  try {
    const { filter, page, limit, skip, sort } = buildListQuery(req.query, {
      exactFilters: ["staff", "period", "status"],
    });

    const [items, total] = await Promise.all([
      SalaryPayment.find(filter).populate("staff", "fullName").sort(sort).skip(skip).limit(limit),
      SalaryPayment.countDocuments(filter),
    ]);

    res.json(paginatedResponse(items, total, page, limit));
  } catch (err) {
    next(err);
  }
}

// Creates a pending salary record for a period, snapshotting the staff
// member's current basicSalary as baseAmount unless overridden.
export async function create(req, res, next) {
  try {
    const { staff: staffId, period, baseAmount, bonuses = 0, deductions = 0, notes } = req.body;
    if (!staffId || !period) {
      return res.status(400).json({ message: "staff and period are required" });
    }

    const staff = await Staff.findOne({ _id: staffId, archivedAt: null });
    if (!staff) return res.status(404).json({ message: "Staff not found" });

    const resolvedBase = baseAmount ?? staff.basicSalary;

    const salary = await SalaryPayment.create({
      staff: staffId,
      period,
      baseAmount: resolvedBase,
      bonuses,
      deductions,
      netAmount: computeNetSalary({ baseAmount: resolvedBase, bonuses, deductions }),
      notes,
    });

    res.status(201).json(salary);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "A salary record for this staff member and period already exists" });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
}

// Creates one pending salary record for every active staff member. Each
// record snapshots that staff member's own basic salary, while optional
// shared bonuses/deductions apply to the whole batch. Existing records for
// the same period are reported as skipped rather than failing the run.
export async function bulkGenerate(req, res, next) {
  try {
    const { period, bonuses = 0, deductions = 0, notes = "" } = req.body;
    if (!period || !String(period).trim()) {
      return res.status(400).json({ message: "period is required" });
    }

    const resolvedBonuses = bonuses === "" ? 0 : Number(bonuses);
    const resolvedDeductions = deductions === "" ? 0 : Number(deductions);
    if (!Number.isFinite(resolvedBonuses) || resolvedBonuses < 0 || !Number.isFinite(resolvedDeductions) || resolvedDeductions < 0) {
      return res.status(400).json({ message: "Bonuses and deductions must be valid numbers of 0 or more" });
    }

    const staffMembers = await Staff.find({ status: "active", archivedAt: null }).sort({ fullName: 1 });
    const attempts = await Promise.all(
      staffMembers.map(async (staff) => {
        try {
          const salary = await SalaryPayment.create({
            staff: staff._id,
            period: String(period).trim(),
            baseAmount: staff.basicSalary,
            bonuses: resolvedBonuses,
            deductions: resolvedDeductions,
            netAmount: computeNetSalary({ baseAmount: staff.basicSalary, bonuses: resolvedBonuses, deductions: resolvedDeductions }),
            notes,
          });
          return { salary };
        } catch (error) {
          if (error.code === 11000) {
            return { skipped: { staff: staff._id, fullName: staff.fullName, reason: "salary record already exists for this period" } };
          }
          throw error;
        }
      })
    );

    const created = attempts.flatMap((attempt) => (attempt.salary ? [attempt.salary] : []));
    const skipped = attempts.flatMap((attempt) => (attempt.skipped ? [attempt.skipped] : []));
    res.status(201).json({ createdCount: created.length, skippedCount: skipped.length, created, skipped });
  } catch (err) {
    if (err.name === "ValidationError") return res.status(400).json({ message: err.message });
    next(err);
  }
}

// The critical piece: marking a salary "paid" and recording the
// corresponding expense must succeed or fail together. If a crash or
// error happened between the two writes without a transaction, you could
// end up with a salary marked paid but no expense on the books (or vice
// versa) — exactly what the spec's "linked expense-on-salary-payment"
// requirement is guarding against.
export async function markPaid(req, res, next) {
  let session;
  try {
    session = await mongoose.startSession();
    const { expenseCategory } = req.body;
    if (!expenseCategory) {
      return res.status(400).json({ message: "expenseCategory is required to record the linked expense" });
    }

    let result;
    await session.withTransaction(async () => {
      const salary = await SalaryPayment.findById(req.params.id).populate("staff").session(session);
      if (!salary) {
        const err = new Error("Salary record not found");
        err.status = 404;
        throw err;
      }
      if (salary.status === "paid") {
        const err = new Error("This salary has already been marked as paid");
        err.status = 409;
        throw err;
      }

      salary.status = "paid";
      salary.paidAt = new Date();
      salary.paidBy = req.user._id;
      await salary.save({ session });

      const [expense] = salary.netAmount === 0 ? [null] : await Expense.create(
        [
          {
            category: expenseCategory,
            amount: salary.netAmount,
            description: `Salary payment - ${salary.staff.fullName} (${salary.period})`,
            expenseDate: salary.paidAt,
            recordedBy: req.user._id,
            sourceSalaryPayment: salary._id,
          },
        ],
        { session }
      );

      result = { salary, expense };
    });

    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    if (err.code === 11000) {
      // sourceSalaryPayment unique index tripped - shouldn't happen given
      // the status check above, but guards against a race condition.
      return res.status(409).json({ message: "This salary payment already has a linked expense" });
    }
    next(err);
  } finally {
    await session?.endSession();
  }
}
