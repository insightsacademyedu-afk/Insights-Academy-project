import request from "supertest";
import User from "../../models/User.js";
import Staff from "../../models/Staff.js";

// --- Low-level cookie helpers -------------------------------------------

// supertest's `set-cookie` header entries look like "name=value; Path=/; ..."
export function extractCookieValue(res, name) {
  const raw = res.headers["set-cookie"] || [];
  for (const c of raw) {
    const match = c.match(new RegExp(`^${name}=([^;]+)`));
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

// Every mutating route in this app is protected by the double-submit CSRF
// cookie (see middleware/csrf.js) — attach it the same way a real browser's
// frontend JS would: read the readable ams_csrf cookie, echo it in the
// x-csrf-token header. Chain this onto any supertest call that isn't GET.
export function withCsrf(pendingRequest, csrfToken) {
  return pendingRequest.set("x-csrf-token", csrfToken || "");
}

// --- User/session factories ---------------------------------------------

// Creates a user directly via the model (bypassing HTTP) for test setup
// speed, then logs in over HTTP for a real cookie + CSRF token, exactly
// like a real client would get them.
export async function createAndLoginUser(app, { role = "admin", password = "Password123!", ...overrides } = {}) {
  const passwordHash = await User.hashPassword(password);
  const suffix = overrides.username || `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const user = await User.create({
    username: suffix,
    email: overrides.email || `${suffix}@example.com`,
    passwordHash,
    role,
    status: "active",
    staffId: overrides.staffId || null,
  });

  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ username: user.username, password });
  const csrfToken = extractCookieValue(res, "ams_csrf");

  return { user, agent, csrfToken, loginRes: res };
}

export async function createAdminSession(app, overrides = {}) {
  return createAndLoginUser(app, { role: "admin", ...overrides });
}

// Creates a Staff profile + linked login account (role "staff"), then logs
// in, mirroring exactly what Phase 3's create-login endpoint does.
export async function createTeacherSession(app, { fullName = "Test Teacher", ...overrides } = {}) {
  const staff = await Staff.create({ fullName, status: "active" });
  const session = await createAndLoginUser(app, { role: "staff", staffId: staff._id, ...overrides });
  // The real create-login flow (staffController.createLogin) links both
  // directions: User.staffId -> Staff and Staff.user -> User. Mirror that
  // here too, or anything that reads staff.user (e.g. revoke-login) would
  // wrongly see this staff member as having no login account.
  staff.user = session.user._id;
  await staff.save();
  return { staff, ...session };
}
