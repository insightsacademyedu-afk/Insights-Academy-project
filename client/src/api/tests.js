import api from "./client";
import { createResourceApi } from "./resource";

// Base list/getOne/create from the generic factory work as-is against
// server/routes/testRoutes.js (list/getOne/create match the plain CRUD
// shape), but there is no PUT/DELETE for a Test at all — a test is never
// edited or removed once created, only progressed through the
// draft -> finalized -> amended workflow via the dedicated actions below.
// So, like api/fees.js, this hand-picks the routes that actually exist
// instead of spreading the full createResourceApi (which would offer
// update()/remove() that would just 404).
const base = createResourceApi("/tests");

export const testsApi = {
  // GET /tests — {items,page,limit,total,totalPages}. Teachers are
  // automatically scoped server-side to tests they created
  // (testController.list sets filter.createdBy = req.user.staffId for
  // non-admins) — no client-side filtering needed for that.
  list: base.list,
  // GET /tests/:id — NOT a bare test: returns { test, results }, where
  // each result already has a `summary` (percentage/grade/passed) computed
  // server-side via utils/grading.js#summarize().
  getOne: base.getOne,
  // POST /tests — { title, class, section, subject, academicSession,
  // maxMarks, passingMarks?, testDate, createdBy? }. `createdBy` is
  // required when an admin creates it (on behalf of a teacher) and
  // ignored/derived from the session for a teacher creating their own.
  create: base.create,
  // GET /tests/:id/roster — { roster: [{student, fullName,
  // admissionNumber, rollNumber}] }. The enrolled students for this
  // test's exact class/section/academicSession, for building the
  // mark-entry table (added alongside this frontend phase — see
  // PROGRESS.md, no prior route exposed this).
  roster(id) {
    return api.get(`/tests/${id}/roster`).then((r) => r.data);
  },
  // POST /tests/:id/marks — { entries: [{student, marksObtained, remarks?}] }.
  // Only works while the test is still "draft"; re-submitting the same
  // student upserts (findOneAndUpdate), so this doubles as both the
  // initial entry screen and any edit made before finalizing.
  enterMarks(id, body) {
    return api.post(`/tests/${id}/marks`, body).then((r) => r.data);
  },
  // POST /tests/:id/finalize — no body. Locks the test; further
  // corrections must go through amendMark below.
  finalize(id) {
    return api.post(`/tests/${id}/finalize`).then((r) => r.data);
  },
  // POST /tests/:id/amend — { student, newMarks, reason }. Only works
  // once finalized; appends to TestResult.amendments rather than
  // overwriting silently.
  amendMark(id, body) {
    return api.post(`/tests/${id}/amend`, body).then((r) => r.data);
  },
};
