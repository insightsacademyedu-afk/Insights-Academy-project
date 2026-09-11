import api from "./client";

export function listArchive(params = {}) {
  return api.get("/archive", { params }).then((response) => response.data);
}

export function restoreArchive(id, credentials) {
  return api.post(`/archive/${id}/restore`, credentials).then((response) => response.data);
}
