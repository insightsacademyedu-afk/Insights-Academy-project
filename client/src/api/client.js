import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api";

// Reads the readable CSRF cookie the backend sets (`ams_csrf`) so it can be
// echoed back in the `x-csrf-token` header on mutating requests — this is
// the double-submit-cookie scheme implemented in server/middleware/csrf.js.
function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)ams_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // send/receive the httpOnly auth cookie + csrf cookie
});

api.interceptors.request.use((config) => {
  const method = (config.method || "get").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = getCsrfToken();
    if (token) config.headers["x-csrf-token"] = token;
  }
  return config;
});

// Normalizes backend error shape ({ message }) into something callers can
// read consistently, and flags 401s so the auth layer can react.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.endsWith("/auth/login")) window.dispatchEvent(new Event("ams:session-expired"));
    const message =
      err.response?.data?.message || err.message || "Something went wrong. Please try again.";
    return Promise.reject({ ...err, message, status: err.response?.status });
  }
);

export default api;
