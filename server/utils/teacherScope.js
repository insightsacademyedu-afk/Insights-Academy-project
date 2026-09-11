import TeacherClassAssignment from "../models/TeacherClassAssignment.js";
import StudentClassAssignment from "../models/StudentClassAssignment.js";

// ---------------------------------------------------------------------
// This module is the single place where "what is this teacher allowed to
// touch" gets computed. Phases 4 (students), 6 (tests/exams/marks), and
// any future teacher-facing feature MUST go through these helpers rather
// than re-deriving authorization inline. That's how we guarantee the
// server-side rule from the spec holds everywhere:
//   "A teacher must ONLY access students/records assigned to that teacher,
//    enforced on every endpoint, not just hidden buttons."
// ---------------------------------------------------------------------

// Returns the list of active assignments for a given Staff id, optionally
// narrowed to a specific academic session.
export async function getTeacherAssignments(staffId, { academicSession } = {}) {
  const filter = { teacher: staffId, status: "active", archivedAt: null };
  if (academicSession) filter.academicSession = academicSession;
  return TeacherClassAssignment.find(filter).lean();
}

// Returns the distinct set of {classIds, sectionIds, subjectIds} a teacher
// is authorized for — handy for building a Mongo `$in` filter in list views.
export async function getTeacherScope(staffId, opts = {}) {
  const assignments = await getTeacherAssignments(staffId, opts);
  return {
    assignments,
    classIds: [...new Set(assignments.map((a) => String(a.class)))],
    sectionIds: [...new Set(assignments.map((a) => String(a.section)))],
    subjectIds: [...new Set(assignments.map((a) => String(a.subject)))],
  };
}

// The core guard: is this teacher specifically authorized for this exact
// class+section+subject(+session) combination? Use this before allowing a
// teacher to create a test, enter marks, or view a class roster for a
// given subject — not just "is this teacher assigned to the class at all."
export async function isTeacherAuthorizedFor(staffId, { classId, sectionId, subjectId, academicSession }) {
  const filter = {
    teacher: staffId,
    status: "active",
    archivedAt: null,
  };
  if (classId) filter.class = classId;
  if (sectionId) filter.section = sectionId;
  if (subjectId) filter.subject = subjectId;
  if (academicSession) filter.academicSession = academicSession;

  const match = await TeacherClassAssignment.exists(filter);
  return Boolean(match);
}

// Returns the distinct {class, section} PAIRS a teacher is authorized for.
// This is deliberately not just classIds + sectionIds independently:
// a teacher assigned to Class9/SectionA and Class10/SectionB must NOT be
// treated as authorized for Class9/SectionB or Class10/SectionA.
export async function getTeacherClassSectionPairs(staffId, opts = {}) {
  const assignments = await getTeacherAssignments(staffId, opts);
  const seen = new Set();
  const pairs = [];
  for (const a of assignments) {
    const key = `${a.class}:${a.section}:${a.academicSession}`;
    if (!seen.has(key)) {
      seen.add(key);
      pairs.push({ class: a.class, section: a.section, academicSession: a.academicSession });
    }
  }
  return pairs;
}

// Builds a Mongo filter for StudentClassAssignment restricted to a
// teacher's authorized class/section pairs. Use this for any "list
// students" query instead of filtering by class/section independently.
export function buildStudentAssignmentFilterFromPairs(pairs, extra = {}) {
  if (pairs.length === 0) {
    // No assignments at all -> filter that can never match anything,
    // rather than accidentally falling through to an unfiltered query.
    return { _id: null, ...extra };
  }
  return {
    $or: pairs.map((p) => ({ class: p.class, section: p.section, ...(p.academicSession ? { academicSession: p.academicSession } : {}) })),
    status: "active",
    archivedAt: null,
    ...extra,
  };
}

// Point check: is this specific student accessible to this teacher, based
// on any of the student's class/section assignments (current or past)
// matching any of the teacher's assignments (current or past)? Used for
// single-student profile/detail routes where the ID comes straight from
// the URL — the exact IDOR scenario called out in the spec.
export async function isStudentAccessibleByTeacher(staffId, studentId) {
  const pairs = await getTeacherClassSectionPairs(staffId);
  if (pairs.length === 0) return false;

  const filter = buildStudentAssignmentFilterFromPairs(pairs, { student: studentId });
  const match = await StudentClassAssignment.exists(filter);
  return Boolean(match);
}

// Express middleware: 403s unless the logged-in teacher can access the
// student referenced by req.params[paramName]. Admins pass through.
export function requireStudentAccess(paramName = "id") {
  return async (req, res, next) => {
    try {
      if (req.user.role === "admin") return next();
      if (!req.user.staffId) {
        return res.status(403).json({ message: "No staff profile linked to this account" });
      }

      const studentId = req.params[paramName];
      const allowed = await isStudentAccessibleByTeacher(req.user.staffId, studentId);
      if (!allowed) {
        return res.status(403).json({ message: "You are not authorized to access this student" });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Express middleware factory: blocks the request with 403 unless the
// logged-in teacher is authorized for the class/section/subject referenced
// in the request. Admins always pass through untouched.
//
// `extract(req)` must return { classId, sectionId, subjectId, academicSession }
// pulled from req.params/req.body/req.query as appropriate for that route.
export function requireTeacherScope(extract) {
  return async (req, res, next) => {
    try {
      if (req.user.role === "admin") return next();

      if (!req.user.staffId) {
        return res.status(403).json({ message: "No staff profile linked to this account" });
      }

      const target = extract(req);
      const authorized = await isTeacherAuthorizedFor(req.user.staffId, target);

      if (!authorized) {
        return res.status(403).json({
          message: "You are not assigned to this class/section/subject",
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
