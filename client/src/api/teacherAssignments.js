import api from "./client";
import { createResourceApi } from "./resource";

export const teacherAssignmentsApi = {
  ...createResourceApi("/teacher-assignments"),
  // GET /teacher-assignments/mine — { items } (no pagination — a single
  // teacher's own assignment list is never large enough to need it,
  // matches teacherAssignmentRoutes.js exactly). Hard-scoped server-side
  // to the caller's own staffId. Used by the Tests page (Phase 6) to
  // restrict a teacher's "new test" form to class/section/subject/session
  // combinations they're actually assigned to, so the form can't offer a
  // choice that testController.create's isTeacherAuthorizedFor() check
  // would reject anyway.
  mine(params = {}) {
    return api.get("/teacher-assignments/mine", { params }).then((r) => r.data);
  },
};
