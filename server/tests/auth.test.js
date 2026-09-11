import request from "supertest";
import app from "../app.js";
import User from "../models/User.js";
import { extractCookieValue } from "./helpers/authHelpers.js";

const COOKIE_NAME = process.env.COOKIE_NAME;

async function makeUser({ username = "jdoe", password = "CorrectHorse123!", status = "active" } = {}) {
  const passwordHash = await User.hashPassword(password);
  return User.create({ username, email: `${username}@example.com`, passwordHash, role: "admin", status });
}

describe("Phase 1 — Auth & RBAC core", () => {
  test("login with correct credentials sets the auth cookie and returns the user without the password hash", async () => {
    await makeUser({ username: "jdoe", password: "CorrectHorse123!" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "jdoe", password: "CorrectHorse123!" });

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe("jdoe");
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.failedLoginAttempts).toBeUndefined();
    expect(res.body.user.tokenVersion).toBeUndefined();
    expect(extractCookieValue(res, COOKIE_NAME)).toBeTruthy();
  });

  test("login with wrong password fails with a generic message", async () => {
    await makeUser({ username: "jdoe", password: "CorrectHorse123!" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "jdoe", password: "WrongPassword!" });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid username or password/i);
  });

  test("nonexistent username gets the SAME generic message as a wrong password (no user enumeration)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "does-not-exist", password: "whatever123" });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid username or password/i);
  });

  test("5 consecutive failed attempts locks the account for the configured window", async () => {
    await makeUser({ username: "lockme", password: "CorrectHorse123!" });
    const agent = request.agent(app);

    for (let i = 0; i < 5; i++) {
      const res = await agent.post("/api/auth/login").send({ username: "lockme", password: "wrong" });
      expect(res.status).toBe(401);
    }

    // 6th attempt — even with the CORRECT password — should now be locked.
    const lockedRes = await agent.post("/api/auth/login").send({ username: "lockme", password: "CorrectHorse123!" });
    expect(lockedRes.status).toBe(423);
    expect(lockedRes.body.message).toMatch(/locked/i);

    const dbUser = await User.findOne({ username: "lockme" }).select("+lockUntil +failedLoginAttempts");
    expect(dbUser.lockUntil).not.toBeNull();
    expect(dbUser.lockUntil.getTime()).toBeGreaterThan(Date.now());
  });

  test("GET /api/auth/me requires a valid session cookie", async () => {
    const noCookieRes = await request(app).get("/api/auth/me");
    expect(noCookieRes.status).toBe(401);

    await makeUser({ username: "meuser", password: "CorrectHorse123!" });
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ username: "meuser", password: "CorrectHorse123!" });

    const meRes = await agent.get("/api/auth/me");
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.username).toBe("meuser");
  });

  test("logout clears the auth cookie and subsequent /me calls fail", async () => {
    await makeUser({ username: "byeuser", password: "CorrectHorse123!" });
    const agent = request.agent(app);
    const loginRes = await agent.post("/api/auth/login").send({ username: "byeuser", password: "CorrectHorse123!" });
    const csrfToken = extractCookieValue(loginRes, "ams_csrf");

    expect((await agent.get("/api/auth/me")).status).toBe(200);

    const logoutRes = await agent.post("/api/auth/logout").set("x-csrf-token", csrfToken);
    expect(logoutRes.status).toBe(200);

    const afterLogout = await agent.get("/api/auth/me");
    expect(afterLogout.status).toBe(401);
  });

  test("deactivating a user invalidates their existing session immediately (not just on token expiry)", async () => {
    const user = await makeUser({ username: "deactme", password: "CorrectHorse123!" });
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ username: "deactme", password: "CorrectHorse123!" });

    expect((await agent.get("/api/auth/me")).status).toBe(200);

    // Simulate an admin deactivating + bumping tokenVersion (what
    // staffController.revokeLogin does for staff accounts).
    user.status = "inactive";
    await user.save();

    const afterDeactivation = await agent.get("/api/auth/me");
    expect(afterDeactivation.status).toBe(403);
  });

  test("bumping tokenVersion alone invalidates the existing cookie (forced logout everywhere)", async () => {
    const user = await makeUser({ username: "bumpme", password: "CorrectHorse123!" });
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ username: "bumpme", password: "CorrectHorse123!" });

    expect((await agent.get("/api/auth/me")).status).toBe(200);

    await User.findByIdAndUpdate(user._id, { $inc: { tokenVersion: 1 } });

    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalidated/i);
  });

  test("state-changing requests without a valid CSRF header are rejected (login itself is exempt)", async () => {
    await makeUser({ username: "csrfuser", password: "CorrectHorse123!" });
    const agent = request.agent(app);

    // Login is CSRF-exempt and should succeed with no x-csrf-token header.
    const loginRes = await agent.post("/api/auth/login").send({ username: "csrfuser", password: "CorrectHorse123!" });
    expect(loginRes.status).toBe(200);

    // But logout (a normal mutating route) should be rejected without the header.
    const res = await agent.post("/api/auth/logout");
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/csrf/i);
  });
});
