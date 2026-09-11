import AcademicSession from "../../models/AcademicSession.js";
import Class from "../../models/Class.js";
import Section from "../../models/Section.js";
import Subject from "../../models/Subject.js";
import Guardian from "../../models/Guardian.js";
import Student from "../../models/Student.js";
import StudentClassAssignment from "../../models/StudentClassAssignment.js";
import TeacherClassAssignment from "../../models/TeacherClassAssignment.js";

// Creates a minimal, valid session -> class -> section (+ optional subject)
// chain directly via models. Used as fixture setup by tests for later
// phases so each of those test files isn't re-proving Phase 2's own logic.
export async function createAcademicChain(overrides = {}) {
  const session = await AcademicSession.create({
    name: overrides.sessionName || `Session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
  });

  const klass = await Class.create({
    name: overrides.className || "10th",
    academicSession: session._id,
  });

  const section = await Section.create({
    name: overrides.sectionName || "A",
    class: klass._id,
  });

  const subject = await Subject.create({
    name: overrides.subjectName || "Mathematics",
    code: overrides.subjectCode || `MATH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
  });

  return { session, klass, section, subject };
}

// Creates Guardian + Student + StudentClassAssignment directly via models
// (bypassing the /api/students HTTP transaction) for tests in later
// phases (fees, tests/exams) that need an enrolled student but aren't
// themselves testing Phase 4's enrollment flow. Requires an academic
// chain from createAcademicChain() above.
export async function createEnrolledStudent({ klass, section, session }, overrides = {}) {
  const guardian = await Guardian.create({
    fullName: overrides.guardianName || "Test Guardian",
    primaryPhone: overrides.guardianPhone || `030${Math.floor(10000000 + Math.random() * 89999999)}`,
  });

  const student = await Student.create({
    admissionNumber: overrides.admissionNumber || `ADM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    fullName: overrides.fullName || "Test Student",
    gender: overrides.gender || "male",
    dob: overrides.dob || "2015-05-01",
    guardian: guardian._id,
    feeDetails: overrides.feeDetails || { monthlyTuition: 5000 },
  });

  const assignment = await StudentClassAssignment.create({
    student: student._id,
    class: klass._id,
    section: section._id,
    academicSession: session._id,
    // A caller-supplied rollNumber is respected as-is (some tests rely on
    // deterministic values like "1"/"2" for bulk-generate ordering), but
    // when omitted we must not default to a fixed "1" — multiple calls
    // against the same class/section/session (very common across these
    // fixtures) would then collide on the unique
    // class+section+academicSession+rollNumber index. Generate a unique
    // one instead.
    rollNumber: overrides.rollNumber || `R-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });

  return { guardian, student, assignment };
}

// Creates a TeacherClassAssignment directly via the model (bypassing the
// /api/teacher-assignments admin route) so tests for later phases (tests/
// exams) that need an authorized teacher aren't re-proving Phase 3's own
// assignment-creation logic. Requires an academic chain from
// createAcademicChain() and a Staff doc (e.g. from createTeacherSession()).
export async function assignTeacher({ klass, section, subject, session }, staffId) {
  return TeacherClassAssignment.create({
    teacher: staffId,
    class: klass._id,
    section: section._id,
    subject: subject._id,
    academicSession: session._id,
  });
}
