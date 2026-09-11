import api from "./client";

export function fetchAdminSummary() {
  return api.get("/dashboard/admin-summary").then((r) => r.data);
}

export function fetchTeacherSummary() {
  return api.get("/dashboard/teacher-summary").then((r) => r.data);
}

// GET /dashboard/tests/:testId/grade-distribution — { testId, totalStudents,
// passCount, failCount, averageMarks }. Ownership-checked server-side
// (admin, or the test's own creator). Surfaced on the Tests page (Phase 6)
// detail view rather than waiting for the Phase 9 reports screen, since
// the route already exists and a per-test pass/fail snapshot belongs
// naturally next to that test's own results.
export function fetchGradeDistribution(testId) {
  return api.get(`/dashboard/tests/${testId}/grade-distribution`).then((r) => r.data);
}
