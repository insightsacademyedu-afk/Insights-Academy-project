import mongoose from "mongoose";
import request from "supertest";
import app from "../app.js";
import { createAdminSession, createTeacherSession, withCsrf } from "./helpers/authHelpers.js";

describe("Phase 2 — Academic setup entities", () => {
  test("admin can create session -> class -> section -> subject -> designation", async () => {
    const { agent, csrfToken } = await createAdminSession(app);

    const sessionRes = await withCsrf(
      agent.post("/api/academic-sessions").send({ name: "2026-2027", startDate: "2026-08-01", endDate: "2027-06-30" }),
      csrfToken
    );
    expect(sessionRes.status).toBe(201);

    const classRes = await withCsrf(
      agent.post("/api/classes").send({ name: "10th", academicSession: sessionRes.body._id }),
      csrfToken
    );
    expect(classRes.status).toBe(201);

    const sectionRes = await withCsrf(
      agent.post("/api/sections").send({ name: "A", class: classRes.body._id }),
      csrfToken
    );
    expect(sectionRes.status).toBe(201);

    const subjectRes = await withCsrf(
      agent.post("/api/subjects").send({ name: "Math", code: "MATH101" }),
      csrfToken
    );
    expect(subjectRes.status).toBe(201);

    const designationRes = await withCsrf(
      agent.post("/api/designations").send({ title: "Head Teacher" }),
      csrfToken
    );
    expect(designationRes.status).toBe(201);
  });

  test("creating a duplicate session name returns 409, not 500", async () => {
    const { agent, csrfToken } = await createAdminSession(app);

    const first = await withCsrf(
      agent.post("/api/academic-sessions").send({ name: "2026-2027", startDate: "2026-08-01", endDate: "2027-06-30" }),
      csrfToken
    );
    expect(first.status).toBe(201);

    const dupe = await withCsrf(
      agent.post("/api/academic-sessions").send({ name: "2026-2027", startDate: "2026-08-01", endDate: "2027-06-30" }),
      csrfToken
    );
    expect(dupe.status).toBe(409);
  });

  test("a class referencing a session ID that doesn't exist is rejected, not silently created", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const fakeSessionId = new mongoose.Types.ObjectId().toString();

    const res = await withCsrf(
      agent.post("/api/classes").send({ name: "10th", academicSession: fakeSessionId }),
      csrfToken
    );

    expect(res.status).toBe(400);
  });

  test("a section referencing a class ID that doesn't exist is rejected, not silently created", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const fakeClassId = new mongoose.Types.ObjectId().toString();

    const res = await withCsrf(agent.post("/api/sections").send({ name: "A", class: fakeClassId }), csrfToken);

    expect(res.status).toBe(400);
  });

  test("archiving a session also hides its attached classes and can be restored", async () => {
    const { agent, csrfToken } = await createAdminSession(app);

    const sessionRes = await withCsrf(
      agent.post("/api/academic-sessions").send({ name: "2026-2027", startDate: "2026-08-01", endDate: "2027-06-30" }),
      csrfToken
    );
    const classRes = await withCsrf(agent.post("/api/classes").send({ name: "10th", academicSession: sessionRes.body._id }), csrfToken);

    const archiveRes = await withCsrf(agent.delete(`/api/academic-sessions/${sessionRes.body._id}`).send({ adminPassword: "Password123!", reason: "Old academic year" }), csrfToken);

    expect(archiveRes.status).toBe(200);
    expect((await agent.get(`/api/academic-sessions/${sessionRes.body._id}`)).status).toBe(404);
    expect((await agent.get(`/api/classes/${classRes.body._id}`)).status).toBe(404);

    const restoreRes = await withCsrf(agent.post(`/api/archive/${archiveRes.body.archive._id}/restore`).send({ adminPassword: "Password123!", reason: "Needed again" }), csrfToken);
    expect(restoreRes.status).toBe(200);
    expect((await agent.get(`/api/academic-sessions/${sessionRes.body._id}`)).status).toBe(200);
    expect((await agent.get(`/api/classes/${classRes.body._id}`)).status).toBe(200);
  });

  test("archiving a class also hides its attached section", async () => {
    const { agent, csrfToken } = await createAdminSession(app);

    const sessionRes = await withCsrf(
      agent.post("/api/academic-sessions").send({ name: "2026-2027", startDate: "2026-08-01", endDate: "2027-06-30" }),
      csrfToken
    );
    const classRes = await withCsrf(
      agent.post("/api/classes").send({ name: "10th", academicSession: sessionRes.body._id }),
      csrfToken
    );
    const sectionRes = await withCsrf(agent.post("/api/sections").send({ name: "A", class: classRes.body._id }), csrfToken);

    const rejected = await withCsrf(agent.delete(`/api/classes/${classRes.body._id}`).send({ adminPassword: "wrong-password", reason: "No longer offered" }), csrfToken);
    expect(rejected.status).toBe(403);
    expect((await agent.get(`/api/classes/${classRes.body._id}`)).status).toBe(200);

    const archiveRes = await withCsrf(agent.delete(`/api/classes/${classRes.body._id}`).send({ adminPassword: "Password123!", reason: "No longer offered" }), csrfToken);

    expect(archiveRes.status).toBe(200);
    expect((await agent.get(`/api/classes/${classRes.body._id}`)).status).toBe(404);
    expect((await agent.get(`/api/sections/${sectionRes.body._id}`)).status).toBe(404);
  });

  test("GET /api/subjects supports pagination, search, and filtering", async () => {
    const { agent, csrfToken } = await createAdminSession(app);

    await withCsrf(agent.post("/api/subjects").send({ name: "Mathematics", code: "MATH1" }), csrfToken);
    await withCsrf(agent.post("/api/subjects").send({ name: "Physics", code: "PHY1" }), csrfToken);
    await withCsrf(agent.post("/api/subjects").send({ name: "Advanced Mathematics", code: "MATH2" }), csrfToken);

    const res = await agent.get("/api/subjects?search=math&page=1&limit=10");

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);
    expect(res.body.items.every((s) => /math/i.test(s.name))).toBe(true);
  });

  test("a staff-role user gets 403 (not 401) on admin-only academic-setup routes", async () => {
    const { agent } = await createTeacherSession(app);

    const res = await agent.get("/api/academic-sessions");
    expect(res.status).toBe(403);
  });

  test("unauthenticated requests get 401 on every academic-setup list endpoint", async () => {
    const endpoints = ["/api/academic-sessions", "/api/classes", "/api/sections", "/api/subjects", "/api/designations"];
    for (const path of endpoints) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
    }
  });
});
