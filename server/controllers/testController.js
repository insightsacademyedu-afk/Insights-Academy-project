import Test from "../models/Test.js";
import TestResult from "../models/TestResult.js";
import StudentClassAssignment from "../models/StudentClassAssignment.js";
import mongoose from "mongoose";
import { getTeacherAssignments, isTeacherAuthorizedFor, buildStudentAssignmentFilterFromPairs } from "../utils/teacherScope.js";
import { summarize } from "../utils/grading.js";
import { buildListQuery, paginatedResponse } from "../utils/listQuery.js";

// loadTestForMutation() throws errors with a `.status` set — this turns
// those into the right HTTP response instead of always falling through
// to the generic 500 handler.
function handleOrNext(err, res, next) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  next(err);
}

// Admins see everything; teachers only see tests for class/section/subject
// combinations they're actually assigned to.
export async function list(req, res, next) {
  try {
    const { filter, page, limit, skip, sort } = buildListQuery(req.query, {
      exactFilters: ["class", "section", "subject", "academicSession", "status"],
    });
    filter.archivedAt = null;

    if (req.user.role !== "admin") {
      if (!req.user.staffId) return res.json(paginatedResponse([], 0, page, limit));
      filter.createdBy = req.user.staffId;
      const assignments = await getTeacherAssignments(req.user.staffId);
      if (!assignments.length) return res.json(paginatedResponse([], 0, page, limit));
      filter.$or = assignments.map(a => ({ class: a.class, section: a.section, subject: a.subject, academicSession: a.academicSession }));
    }

    const [items, total] = await Promise.all([
      Test.find(filter).sort(sort).skip(skip).limit(limit),
      Test.countDocuments(filter),
    ]);

    res.json(paginatedResponse(items, total, page, limit));
  } catch (err) {
    next(err);
  }
}

// Creates a Test. A teacher may only create one for a class/section/subject
// they are actually assigned to — checked here explicitly rather than
// trusting the client, since this is the entry point to the whole
// mark-entry workflow.
export async function create(req, res, next) {
  try {
    const { title, class: classId, section, subject, academicSession, maxMarks, passingMarks, testDate } = req.body;

    if (!title || !classId || !section || !subject || !academicSession || !maxMarks || !testDate) {
      return res.status(400).json({ message: "title, class, section, subject, academicSession, maxMarks and testDate are required" });
    }

    let createdBy;
    if (req.user.role === "admin") {
      // Admin creating on behalf of a teacher must specify which staff member
      createdBy = req.body.createdBy;
      if (!createdBy) {
        return res.status(400).json({ message: "createdBy (staff id) is required when an admin creates a test" });
      }
    } else {
      if (!req.user.staffId) {
        return res.status(403).json({ message: "No staff profile linked to this account" });
      }
      createdBy = req.user.staffId;

      const authorized = await isTeacherAuthorizedFor(createdBy, {
        classId,
        sectionId: section,
        subjectId: subject,
        academicSession,
      });
      if (!authorized) {
        return res.status(403).json({ message: "You are not assigned to this class/section/subject" });
      }
    }

    const test = await Test.create({
      title,
      class: classId,
      section,
      subject,
      academicSession,
      createdBy,
      maxMarks,
      passingMarks: passingMarks ?? 0,
      testDate,
    });

    res.status(201).json(test);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
}

// Ownership check reused by every mutating test route below: admins pass,
// teachers must be the test's own creator. This is intentionally stricter
// than "assigned to the class" — a teacher shouldn't edit a colleague's
// test even if they also teach that class/subject.
async function loadTestForMutation(req) {
  const test = await Test.findOne({ _id: req.params.id, archivedAt: null });
  if (!test) {
    const err = new Error("Test not found");
    err.status = 404;
    throw err;
  }
  if (req.user.role !== "admin" && String(test.createdBy) !== String(req.user.staffId)) {
    const err = new Error("You can only manage tests you created");
    err.status = 403;
    throw err;
  }
  if (req.user.role !== "admin" && !await isTeacherAuthorizedFor(req.user.staffId, { classId: test.class, sectionId: test.section, subjectId: test.subject, academicSession: test.academicSession })) {
    throw Object.assign(new Error("Your assignment no longer permits access to this test"), { status: 403 });
  }
  return test;
}

export async function getOne(req, res, next) {
  try {
    const test = await loadTestForMutation(req);
    const results = await TestResult.find({ test: test._id }).populate("student", "fullName admissionNumber");
    res.json({
      test,
      results: results.map((r) => ({
        ...r.toObject(),
        summary: summarize(r.marksObtained, test.maxMarks, test.passingMarks),
      })),
    });
  } catch (err) {
    handleOrNext(err, res, next);
  }
}

// The frontend's mark-entry screen needs the full roster of students
// enrolled in this test's exact class/section/academicSession — not just
// the students who already have a TestResult — so it can render one row
// per enrolled student, prefilled where a result already exists. No route
// exposed this anywhere else in the API (StudentClassAssignment has no
// dedicated routes of its own; studentController.list only supports
// status/gender exact filters, no class/section), so this is added here,
// scoped to one specific test the caller already has access to via
// loadTestForMutation — not a general-purpose roster-by-class endpoint.
export async function roster(req, res, next) {
  try {
    const test = await loadTestForMutation(req);

    const assignments = await StudentClassAssignment.find({
      class: test.class,
      section: test.section,
      academicSession: test.academicSession,
      status: "active",
    })
      .sort({ rollNumber: 1 })
      .populate({ path: "student", select: "fullName admissionNumber" });

    const roster = assignments
      .filter((a) => a.student) // defensive: skip if the student was hard-deleted
      .map((a) => ({
        student: a.student._id,
        fullName: a.student.fullName,
        admissionNumber: a.student.admissionNumber,
        rollNumber: a.rollNumber,
      }));

    res.json({ roster });
  } catch (err) {
    handleOrNext(err, res, next);
  }
}

// Bulk mark entry (or update, while the test is still a draft).
// Body: { entries: [{ student, marksObtained, remarks }, ...] }
export async function enterMarks(req, res, next) {
  try {
    const test = await loadTestForMutation(req);

    if (test.status === "finalized") {
      return res.status(409).json({ message: "This test is finalized. Use the amendment endpoint to correct a mark." });
    }

    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ message: "entries must be a non-empty array" });
    }

    // Verify every student referenced is actually enrolled in this
    // test's class/section — prevents a teacher entering marks for a
    // student who isn't even in that class.
    if (entries.some(e => !e || typeof e.student !== "string" || !Number.isFinite(e.marksObtained) || e.marksObtained < 0 || e.marksObtained > test.maxMarks)) {
      return res.status(400).json({ message: "Each entry needs a student and valid marks within the test range" });
    }
    const studentIds = entries.map((e) => e.student);
    if (new Set(studentIds).size !== studentIds.length) return res.status(400).json({ message: "Duplicate student entries" });
    const enrolledCount = await StudentClassAssignment.countDocuments(
      buildStudentAssignmentFilterFromPairs(
        [{ class: test.class, section: test.section }],
        { student: { $in: studentIds }, academicSession: test.academicSession }
      )
    );
    if (enrolledCount !== new Set(studentIds.map(String)).size) {
      return res.status(400).json({ message: "One or more students are not enrolled in this class/section" });
    }

    let results = [];
    await mongoose.connection.transaction(async session => {
      results = [];
      const lock = await Test.updateOne({ _id: test._id, status: "draft" }, { $inc: { __v: 1 } }, { session });
      if (!lock.matchedCount) throw Object.assign(new Error("This test is finalized"), { status: 409 });
    for (const entry of entries) {
      if (entry.marksObtained > test.maxMarks) {
        return res.status(400).json({
          message: `marksObtained for student ${entry.student} exceeds maxMarks (${test.maxMarks})`,
        });
      }

      const result = await TestResult.findOneAndUpdate(
        { test: test._id, student: entry.student },
        { marksObtained: entry.marksObtained, remarks: entry.remarks || "" },
        { new: true, upsert: true, runValidators: true, session }
      );
      results.push(result);
    }
    });

    res.json({ savedCount: results.length, results });
  } catch (err) {
    handleOrNext(err, res, next);
  }
}

// Locks the test. After this, entries can only change via amendRark below,
// which keeps a visible history instead of a silent overwrite.
export async function finalize(req, res, next) {
  try {
    const test = await loadTestForMutation(req);
    if (test.status === "finalized") {
      return res.status(400).json({ message: "Already finalized" });
    }

    test.status = "finalized";
    test.finalizedAt = new Date();
    await test.save();

    res.json(test);
  } catch (err) {
    handleOrNext(err, res, next);
  }
}

// Post-finalization correction: requires a reason, and appends to the
// amendment trail rather than just changing marksObtained silently.
export async function amendMark(req, res, next) {
  try {
    const test = await loadTestForMutation(req);
    if (test.status !== "finalized") {
      return res.status(400).json({ message: "Use the regular mark-entry endpoint while the test is still a draft" });
    }

    const { student, newMarks, reason } = req.body;
    if (student === undefined || newMarks === undefined || !reason) {
      return res.status(400).json({ message: "student, newMarks and reason are required" });
    }
    if (!Number.isFinite(newMarks) || newMarks < 0 || newMarks > test.maxMarks) {
      return res.status(400).json({ message: `newMarks exceeds maxMarks (${test.maxMarks})` });
    }

    const result = await TestResult.findOne({ test: test._id, student });
    if (!result) return res.status(404).json({ message: "No existing result for this student on this test" });

    result.amendments.push({
      previousMarks: result.marksObtained,
      newMarks,
      reason,
      amendedBy: req.user._id,
    });
    result.marksObtained = newMarks;
    await result.save();

    res.json(result);
  } catch (err) {
    handleOrNext(err, res, next);
  }
}
