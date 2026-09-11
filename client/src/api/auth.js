import api from "./client";

export function login(username, password) {
  return api.post("/auth/login", { username, password }).then((r) => r.data.user);
}

export function logout() {
  return api.post("/auth/logout").then((r) => r.data);
}

export function changePassword(values) {
  return api.post("/auth/change-password", values).then(r => r.data);
}

export function fetchMe() {
  return api.get("/auth/me").then((r) => r.data.user);
}
