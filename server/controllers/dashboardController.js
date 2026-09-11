import { sumMoney } from "../utils/money.js";
import mongoose from "mongoose";
import Student from "../models/Student.js";
import Staff from "../models/Staff.js";
import FeeInvoice from "../models/FeeInvoice.js";
import Expense from "../models/Expense.js";
import SalaryPayment from "../models/SalaryPayment.js";
import TestResult from "../models/TestResult.js";
import Test from "../models/Test.js";
import Notification from "../models/Notification.js";
import { isTeacherAuthorizedFor, getTeacherClassSectionPairs, buildStudentAssignmentFilterFromPairs } from "../utils/teacherScope.js";
import StudentClassAssignment from "../models/StudentClassAssignment.js";

// Every number here is computed with a single aggregation/query rather
// than pulled from a cached/denormalized counter, so the dashboard can
// never drift from the underlying data — the same principle used for
// FeeInvoice.totalAmount and SalaryPayment.netAmount elsewhere.
export async function adminSummary(req, res, next) {
  try {
    const { academicSession } = req.query;
    if (academicSession && !mongoose.isValidObjectId(academicSession)) return res.status(400).json({ message: "Invalid academicSession id" });

    const [studentCounts, staffCounts, feeAgg, expenseAgg, salaryAgg, notificationCounts] = await Promise.all([
      Student.aggregate([{ $match: { archivedAt: null } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      Staff.aggregate([{ $match: { archivedAt: null } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
      FeeInvoice.aggregate([
        ...(academicSession && mongoose.isValidObjectId(academicSession)
          ? [{ $match: { academicSession: new mongoose.Types.ObjectId(academicSession) } }]
          : []),
        {
          $group: {
            _id: null,
            totalBilled: { $sum: "$totalAmount" },
            totalCollected: { $sum: "$amountPaid" },
            invoiceCount: { $sum: 1 },
            // Excludes "waived" invoices, same as outstandingFeesReport's
            // own filter (Session 3 fix) — a waived invoice is
            // administratively excused, not money still owed, so it
            // shouldn't count as outstanding even though totalAmount >
            // amountPaid is common for a waived invoice (that's usually
            // *why* it was waived instead of collected). Without this,
            // this total and outstandingFeesReport's total would silently
            // disagree the moment a waived invoice existed with a
            // nonzero unpaid balance.
            outstanding: {
              $sum: {
                $cond: [{ $eq: ["$status", "waived"] }, 0, { $subtract: ["$totalAmount", "$amountPaid"] }],
              },
            },
          },
        },
      ]),
      Expense.aggregate([{ $match: { archivedAt: null } }, { $group: { _id: null, totalExpenses: { $sum: "$amount" }, count: { $sum: 1 } } }]),
      SalaryPayment.aggregate([
        { $group: { _id: "$status", total: { $sum: "$netAmount" }, count: { $sum: 1 } } },
      ]),
      Notification.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);

    res.json({
      students: shapeStatusCounts(studentCounts),
      staff: shapeStatusCounts(staffCounts),
      fees: feeAgg[0]
        ? {
            totalBilled: sumMoney(feeAgg[0].totalBilled),
            totalCollected: sumMoney(feeAgg[0].totalCollected),
            outstanding: sumMoney(feeAgg[0].outstanding),
            invoiceCount: feeAgg[0].invoiceCount,
          }
        : { totalBilled: 0, totalCollected: 0, outstanding: 0, invoiceCount: 0 },
      expenses: expenseAgg[0] ? { ...expenseAgg[0], totalExpenses: sumMoney(expenseAgg[0].totalExpenses) } : { totalExpenses: 0, count: 0 },
      salaries: shapeStatusCounts(salaryAgg.map(row => ({ ...row, total: sumMoney(row.total) })), "total"),
      notifications: shapeStatusCounts(notificationCounts),
    });
  } catch (err) {
    next(err);
  }
}

// A teacher's own dashboard: scoped strictly to their assigned
// classes/sections, reusing the exact same scoping helper from Phase 3/4
// rather than a separate, easy-to-get-wrong query.
export async function teacherSummary(req, res, next) {
  try {
    if (!req.user.staffId) {
      return res.json({ studentCount: 0, testCount: 0, pendingTests: 0 });
    }

    const pairs = await getTeacherClassSectionPairs(req.user.staffId, {
      academicSession: req.query.academicSession,
    });
    const assignmentFilter = buildStudentAssignmentFilterFromPairs(pairs);
    const studentIds = await StudentClassAssignment.find(assignmentFilter).distinct("student");

    const [testCounts] = await Promise.all([
      Test.aggregate([
        { $match: { createdBy: req.user.staffId, archivedAt: null } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      studentCount: studentIds.length,
      tests: shapeStatusCounts(testCounts),
    });
  } catch (err) {
    next(err);
  }
}

// Grade distribution across a test or a subject, for the academic reports
// view. Reuses the same summarize() grading logic indirectly by grouping
// on the already-stored marksObtained against the test's own thresholds.
export async function gradeDistribution(req, res, next) {
  try {
    const { testId } = req.params;
    const test = await Test.findOne({ _id: testId, archivedAt: null });
    if (!test) return res.status(404).json({ message: "Test not found" });

    if (req.user.role !== "admin" && (String(test.createdBy) !== String(req.user.staffId) || !await isTeacherAuthorizedFor(req.user.staffId, { classId: test.class, sectionId: test.section, subjectId: test.subject, academicSession: test.academicSession }))) {
      return res.status(403).json({ message: "You can only view results for your own tests" });
    }

    const results = await TestResult.find({ test: testId });
    const passCount = results.filter((r) => r.marksObtained >= test.passingMarks).length;

    res.json({
      testId,
      totalStudents: results.length,
      passCount,
      failCount: results.length - passCount,
      averageMarks: results.length
        ? Math.round((results.reduce((s, r) => s + r.marksObtained, 0) / results.length) * 100) / 100
        : 0,
    });
  } catch (err) {
    next(err);
  }
}

function shapeStatusCounts(aggResult, valueField = "count") {
  return aggResult.reduce((acc, row) => {
    acc[row._id || "unknown"] = valueField === "count" ? row.count : { count: row.count, total: row.total };
    return acc;
  }, {});
}
