import api from "./client";
import { createResourceApi } from "./resource";

// Base CRUD (list/getOne/create/update/remove) plus the three dedicated
// login-management actions from server/controllers/staffController.js,
// which live outside the generic crudFactory on purpose.
export const staffApi = {
  ...createResourceApi("/staff"),
  createLogin(id, body) {
    return api.post(`/staff/${id}/create-login`, body).then((r) => r.data);
  },
  resetPassword(id, body) {
    return api.post(`/staff/${id}/reset-password`, body).then((r) => r.data);
  },
  revokeLogin(id) {
    return api.post(`/staff/${id}/revoke-login`).then((r) => r.data);
  },
};
