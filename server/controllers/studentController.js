import mongoose from "mongoose";
import Student from "../models/Student.js";
import Guardian from "../models/Guardian.js";
import StudentClassAssignment from "../models/StudentClassAssignment.js";
import TestResult from "../models/TestResult.js";
import FeeInvoice from "../models/FeeInvoice.js";
import Sequence from "../models/Sequence.js";
import { buildListQuery, paginatedResponse } from "../utils/listQuery.js";
import { getTeacherClassSectionPairs, buildStudentAssignmentFilterFromPairs } from "../utils/teacherScope.js";

// Teachers get a reduced view: no fee/financial data, no CNIC — per spec,
// "Teacher sees only the permitted academic information." Admins get the
// full profile. This is the single place that decides the shape, so no
// route can accidentally leak fee data to a teacher by forgetting a check.
function shapeForRole(studentDoc, role) {
  const student = studentDoc.toJSON ? studentDoc.toJSON() : studentDoc;
  if (role === "admin") return student;

  const { feeDetails, totalPayable, cnicOrBForm, ...rest } = student;
  return rest;
}

function numericMaximum(values) {
  return values.reduce((highest, value) => {
    const text = String(value || "").trim();
    return /^\d+$/.test(text) ? Math.max(highest, Number(text)) : highest;
  }, 0);
}

async function incrementSequence(key, baseline, session) {
  const sequence = await Sequence.findOneAndUpdate(
    { _id: key },
    [{ $set: { value: { $add: [{ $max: [{ $ifNull: ["$value", 0] }, baseline] }, 1] } } }],
    { upsert: true, new: true, session }
  );
  return sequence.value;
}

async function nextAdmissionNumber(session) {
  const existing = await Student.find({}, { admissionNumber: 1 }).session(session).lean();
  const baseline = Math.max(existing.length, numericMaximum(existing.map((student) => student.admissionNumber)));
  return String(await incrementSequence("student-admission", baseline, session)).padStart(4, "0");
}

async function nextRollNumber({ class: classId }, session) {
  const scope = { class: classId };
  const existing = await StudentClassAssignment.find(scope, { rollNumber: 1 }).session(session).lean();
  const baseline = Math.max(existing.length, numericMaximum(existing.map((assignment) => assignment.rollNumber)));
  const key = `student-roll:${classId}`;
  return String(await incrementSequence(key, baseline, session));
}

export async function list(req, res, next) {
  try {
    const { filter, page, limit, skip, sort } = buildListQuery(req.query, {
      searchFields: ["fullName", "admissionNumber"],
      exactFilters: ["status", "gender"],
    });
    filter.archivedAt = null;

    const requestedAssignmentScope = {};
    if (req.query.academicSession) requestedAssignmentScope.academicSession = req.query.academicSession;
    if (req.query.class) requestedAssignmentScope.class = req.query.class;
    if (req.query.section) requestedAssignmentScope.section = req.query.section;

    if (req.user.role === "admin") {
      if (Object.keys(requestedAssignmentScope).length > 0) {
        const studentIds = await StudentClassAssignment.find({
          ...requestedAssignmentScope,
          status: "active",
          archivedAt: null,
        }).distinct("student");
        filter._id = { $in: studentIds };
      }
      const [items, total] = await Promise.all([
        Student.find(filter).populate("guardian").sort(sort).skip(skip).limit(limit),
        Student.countDocuments(filter),
      ]);
      return res.json(paginatedResponse(items, total, page, limit));
    }

    // --- Teacher path: scoped strictly to their class/section assignments ---
    if (!req.user.staffId) {
      return res.json(paginatedResponse([], 0, page, limit));
    }

    const pairs = await getTeacherClassSectionPairs(req.user.staffId, {
      academicSession: req.query.academicSession,
    });
    const assignmentFilter = buildStudentAssignmentFilterFromPairs(pairs, requestedAssignmentScope);

    const studentIds = await StudentClassAssignment.find(assignmentFilter).distinct("student");
    const scopedFilter = { ...filter, archivedAt: null, _id: { $in: studentIds } };

    const [items, total] = await Promise.all([
      Student.find(scopedFilter).sort(sort).skip(skip).limit(limit),
      Student.countDocuments(scopedFilter),
    ]);

    const shaped = items.map((s) => shapeForRole(s, req.user.role));
    return res.json(paginatedResponse(shaped, total, page, limit));
  } catch (err) {
    next(err);
  }
}

// Assumes `requireStudentAccess()` middleware already ran and confirmed
// this teacher (or admin) may view this student.
export async function getOne(req, res, next) {
  try {
    const student = await Student.findOne({ _id: req.params.id, archivedAt: null }).populate("guardian");
    if (!student) return res.status(404).json({ message: "Not found" });

    const currentAssignment = await StudentClassAssignment.findOne({
      student: student._id,
      status: "active",
      archivedAt: null,
    })
      .sort({ createdAt: -1 })
      .populate("class section academicSession");

    res.json({
      student: shapeForRole(student, req.user.role),
      currentAssignment: currentAssignment || null,
    });
  } catch (err) {
    next(err);
  }
}

// Full enrollment: creates Guardian + Student + initial StudentClassAssignment
// together. Uses a transaction so a failure partway through (e.g. a
// duplicate roll number) never leaves an orphaned Student or Guardian
// record behind. Requires MongoDB running as a replica set — local MongoDB
// clusters (including the free M0 tier) already are one; a bare local
// standalone mongod is not, by default.
export async function create(req, res, next) {
  let session;
  try {
    session = await mongoose.startSession();
    const { guardian, enrollment, admissionNumber: _ignoredAdmissionNumber, ...studentFields } = req.body;

    if (!guardian) {
      return res.status(400).json({ message: "guardian details are required" });
    }
    if (!enrollment || !enrollment.class || !enrollment.section || !enrollment.academicSession) {
      return res.status(400).json({ message: "enrollment (class, section and academicSession) is required" });
    }

    let result;
    await session.withTransaction(async () => {
      const [guardianDoc] = await Guardian.create([guardian], { session });

      const admissionNumber = await nextAdmissionNumber(session);
      const rollNumber = await nextRollNumber(enrollment, session);

      const [studentDoc] = await Student.create(
        [{ ...studentFields, admissionNumber, guardian: guardianDoc._id }],
        { session }
      );

      const [assignmentDoc] = await StudentClassAssignment.create(
        [
          {
            student: studentDoc._id,
            class: enrollment.class,
            section: enrollment.section,
            academicSession: enrollment.academicSession,
            rollNumber,
          },
        ],
        { session }
      );

      result = { student: studentDoc, guardian: guardianDoc, assignment: assignmentDoc };
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: "A student with this admission number, or this roll number in this class/section/session, already exists",
      });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  } finally {
    await session?.endSession();
  }
}

// Admin-only. Updates student + guardian fields but NOT class/section —
// that goes through the dedicated enroll/transfer endpoint below, so
// there's always an explicit StudentClassAssignment record of the change.
export async function update(req, res, next) {
  try {
    const { guardian, enrollment, admissionNumber: _ignoredAdmissionNumber, ...studentFields } = req.body;

    let updated;
    await mongoose.connection.transaction(async session => {
      const student = await Student.findOne({ _id: req.params.id, archivedAt: null }).session(session);
      if (!student) return;
      const { _id, __v, createdAt, updatedAt, ...fields } = studentFields;
      student.set(fields);
      await student.save({ session });
      if (guardian) {
        const contact = await Guardian.findById(student.guardian).session(session);
        if (!contact) throw Object.assign(new Error("Guardian not found"), { status: 400 });
        const { _id: guardianId, __v: version, createdAt: created, updatedAt: modified, ...contactFields } = guardian;
        contact.set(contactFields);
        await contact.save({ session });
      }
      updated = await Student.findById(student._id).session(session).populate("guardian");
    });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 11000) {
      return res.status(409).json({ message: "That admission number is already in use" });
    }
    next(err);
  }
}

// Admin-only. Creates a new StudentClassAssignment for a session (used for
// initial placement corrections, transfers, or year-end promotion) rather
// than overwriting history.
export async function enroll(req, res, next) {
  try {
    const { class: classId, section, academicSession } = req.body;
    if (!classId || !section || !academicSession) {
      return res.status(400).json({ message: "class, section and academicSession are required" });
    }

    const student = await Student.findOne({ _id: req.params.id, archivedAt: null });
    if (!student) return res.status(404).json({ message: "Not found" });

    let assignment;
    await mongoose.connection.transaction(async (session) => {
      const rollNumber = await nextRollNumber({ class: classId, section, academicSession }, session);
      const [created] = await StudentClassAssignment.create([{
        student: student._id,
        class: classId,
        section,
        academicSession,
        rollNumber,
      }], { session });
      assignment = created;
    });

    res.status(201).json(assignment);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: "This student already has an assignment for that session, or the roll number is taken",
      });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
}

// Admin-only. Deactivating rather than hard-deleting is strongly
// recommended once fee/academic history exists. Now that Phase 5 (Fees)
// exists, a student with any fee invoice is blocked from hard deletion —
// deleting a student must never silently delete their financial history.
export async function remove(req, res, next) {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Not found" });

    const hasInvoices = await FeeInvoice.exists({ student: student._id });
    if (hasInvoices || await TestResult.exists({ student: student._id })) {
      return res.status(409).json({
        message: "Cannot delete a student with billing or test-result history. Set their status to inactive instead.",
      });
    }

    await mongoose.connection.transaction(async session => {
      await StudentClassAssignment.deleteMany({ student: student._id }).session(session);
      await Student.deleteOne({ _id: student._id }).session(session);
    });
    res.json({ message: "Deleted" });
  } catch (err) {
    next(err);
  }
}
