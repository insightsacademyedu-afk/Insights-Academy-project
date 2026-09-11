import api from "./client";
import { createResourceApi } from "./resource";

// Base CRUD (list/getOne/create/update/remove) plus the dedicated
// enroll/transfer action from server/controllers/studentController.js
// (`POST /:id/enroll`), which — deliberately — is not part of the plain
// update: class/section placement is always its own StudentClassAssignment
// record, never an overwrite of the previous one.
//
// Note on shapes:
// - list() returns the generic {items,page,limit,total,totalPages} shape,
//   same as every other resource.
// - getOne() does NOT return a bare student — the backend returns
//   { student, currentAssignment }, so callers should destructure that.
// - create()'s body must include nested `guardian` and `enrollment`
//   objects (see studentController.create) — the server does all three
//   inserts (Guardian, Student, StudentClassAssignment) in one transaction.
export const studentsApi = {
  ...createResourceApi("/students"),
  enroll(id, body) {
    return api.post(`/students/${id}/enroll`, body).then((r) => r.data);
  },
};
