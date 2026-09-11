import request from "supertest";
import app from "../app.js";
import { createAdminSession, withCsrf } from "./helpers/authHelpers.js";

// Phase 10 — Security hardening pass. Covers the two errorHandler gaps
// found this session (a malformed ObjectId in a URL param, and malformed
// JSON in a request body both used to fall through to a generic 500), plus
// a couple of standing invariants worth pinning down with a real assertion
// rather than leaving them as "helmet/rate-limiter is configured, trust me".
describe("Phase 10 — security hardening", () => {
  test("a malformed ObjectId in a URL param returns 400, not 500", async () => {
    const { agent, csrfToken } = await createAdminSession(app);

    const res = await agent.get("/api/fees/invoices/not-a-real-id");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid id/i);

    // Same fix, mutating route: PATCH also goes through the same CastError
    // path, not just GET.
    const patchRes = await withCsrf(
      agent.patch("/api/fees/invoices/also-not-an-id/waive").send({}),
      csrfToken
    );
    expect(patchRes.status).toBe(400);
  });

  test("malformed JSON in a request body returns 400 with a generic message, not a raw parser error", async () => {
    const { agent, csrfToken } = await createAdminSession(app);

    const res = await agent
      .post("/api/academic-sessions")
      .set("Content-Type", "application/json")
      .set("x-csrf-token", csrfToken || "")
      .send('{"name": "Broken JSON",');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Malformed JSON in request body");
    // The raw parser error (which can echo back a snippet of the invalid
    // body) must never reach the client.
    expect(res.body.message).not.toMatch(/position|unexpected token/i);
  });

  test("every response carries helmet's baseline security headers", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    // Helmet's default CSP header name in Express 4/helmet 7.
    expect(res.headers["content-security-policy"]).toBeDefined();
  });

  test("staff credential-mutation routes (create-login/reset-password/revoke-login) still work with the tighter sensitive-action rate limiter mounted", async () => {
    // NOTE: `sensitiveActionRateLimiter`'s real ceiling (10/15min in
    // production) can't be exercised here — like `loginRateLimiter`, its
    // `isTest` branch raises the limit to 10000 specifically so the suite
    // doesn't trip it, which means this test can only confirm the limiter
    // is mounted and doesn't break the route, not that the production
    // ceiling is actually 10. Same category of gap as every other
    // env-var-gated or ceiling-gated check left as manual-only elsewhere
    // in this file/PROGRESS.md (e.g. the JWT_SECRET/SEED_ADMIN_PASSWORD
    // production-only guards).
    const { agent, csrfToken } = await createAdminSession(app);
    const staffRes = await withCsrf(
      agent.post("/api/staff").send({ fullName: "Rate Limit Target", email: "rl-target@example.com", phone: "0300-0000000" }),
      csrfToken
    );
    expect(staffRes.status).toBe(201);

    const res = await withCsrf(
      agent.post(`/api/staff/${staffRes.body._id}/create-login`).send({
        username: "rltarget",
        email: "rl-target@example.com",
        password: "TeacherPass123!",
      }),
      csrfToken
    );
    expect(res.status).toBe(201);
  });

  test("a request body over the configured size limit is rejected, not silently truncated", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const oversized = "x".repeat(2 * 1024 * 1024); // 2MB, over the 1mb express.json limit

    const res = await withCsrf(
      agent.post("/api/academic-sessions").send({ name: oversized, startDate: "2026-01-01", endDate: "2026-12-31" }),
      csrfToken
    );
    expect(res.status).toBe(413);
  });
});
