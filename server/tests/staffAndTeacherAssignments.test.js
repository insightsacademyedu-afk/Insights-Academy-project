import mongoose from "mongoose";
import app from "../app.js";
import Staff from "../models/Staff.js";
import { createAdminSession, createTeacherSession, withCsrf } from "./helpers/authHelpers.js";
import { createAcademicChain } from "./helpers/fixtures.js";

describe("Phase 3 — Staff & Teacher Assignment engine", () => {
  test("admin creates a Staff profile, then create-login issues a working staff login", async () => {
    const { agent, csrfToken } = await createAdminSession(app);

    const staffRes = await withCsrf(agent.post("/api/staff").send({ fullName: "Jane Teacher" }), csrfToken);
    expect(staffRes.status).toBe(201);

    const loginRes = await withCsrf(
      agent.post(`/api/staff/${staffRes.body._id}/create-login`).send({
        username: "janet",
        email: "jane@example.com",
        password: "TeacherPass123!",
      }),
      csrfToken
    );
    expect(loginRes.status).toBe(201);
    expect(loginRes.body.user.role).toBe("staff");
    expect(loginRes.body.user.passwordHash).toBeUndefined();

    // The new teacher account should actually be able to log in.
    const teacherLogin = await agent.post("/api/auth/login").send({ username: "janet", password: "TeacherPass123!" });
    expect(teacherLogin.status).toBe(200);
    expect(teacherLogin.body.user.role).toBe("staff");
  });

  test("create-login twice for the same staff member is rejected with 409", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const staffRes = await withCsrf(agent.post("/api/staff").send({ fullName: "Jane Teacher" }), csrfToken);

    await withCsrf(
      agent.post(`/api/staff/${staffRes.body._id}/create-login`).send({ username: "janet", email: "jane@example.com", password: "TeacherPass123!" }),
      csrfToken
    );
    const second = await withCsrf(
      agent.post(`/api/staff/${staffRes.body._id}/create-login`).send({ username: "janet2", email: "jane2@example.com", password: "TeacherPass123!" }),
      csrfToken
    );
    expect(second.status).toBe(409);
  });

  test("admin creates a TeacherClassAssignment for that teacher; assigning a mismatched section is rejected", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const { klass, section, subject, session } = await createAcademicChain();
    const otherChain = await createAcademicChain({ className: "9th", sectionName: "B" });
    const staff = await Staff.create({ fullName: "Assigned Teacher" });

    const goodRes = await withCsrf(
      agent.post("/api/teacher-assignments").send({
        teacher: staff._id,
        class: klass._id,
        section: section._id,
        subject: subject._id,
        academicSession: session._id,
      }),
      csrfToken
    );
    expect(goodRes.status).toBe(201);

    // section belongs to `otherChain.klass`, not `klass` — should be rejected, not silently created.
    const mismatchRes = await withCsrf(
      agent.post("/api/teacher-assignments").send({
        teacher: staff._id,
        class: klass._id,
        section: otherChain.section._id,
        subject: subject._id,
        academicSession: session._id,
      }),
      csrfToken
    );
    expect(mismatchRes.status).toBe(400);
  });

  test("a teacher's /mine endpoint returns only their own assignments, never another teacher's", async () => {
    const { agent: adminAgent, csrfToken } = await createAdminSession(app);
    const { klass, section, subject, session } = await createAcademicChain();

    const teacherA = await createTeacherSession(app, { fullName: "Teacher A" });
    const teacherB = await createTeacherSession(app, { fullName: "Teacher B" });

    await withCsrf(
      adminAgent.post("/api/teacher-assignments").send({
        teacher: teacherA.staff._id,
        class: klass._id,
        section: section._id,
        subject: subject._id,
        academicSession: session._id,
      }),
      csrfToken
    );

    const mineA = await teacherA.agent.get("/api/teacher-assignments/mine");
    expect(mineA.status).toBe(200);
    expect(mineA.body.items.length).toBe(1);
    expect(String(mineA.body.items[0].teacher._id || mineA.body.items[0].teacher)).toBe(String(teacherA.staff._id));

    // Teacher B has no assignments at all — must get an empty list, never A's data.
    const mineB = await teacherB.agent.get("/api/teacher-assignments/mine");
    expect(mineB.status).toBe(200);
    expect(mineB.body.items.length).toBe(0);
  });

  test("revoke-login immediately invalidates the staff member's existing session", async () => {
    const { agent: adminAgent, csrfToken } = await createAdminSession(app);
    const teacher = await createTeacherSession(app, { fullName: "Revoke Me" });

    expect((await teacher.agent.get("/api/auth/me")).status).toBe(200);

    const revokeRes = await withCsrf(adminAgent.post(`/api/staff/${teacher.staff._id}/revoke-login`), csrfToken);
    expect(revokeRes.status).toBe(200);

    const afterRevoke = await teacher.agent.get("/api/auth/me");
    expect(afterRevoke.status).toBe(403);
  });

  test("a staff-role user gets 403 on admin-only staff/teacher-assignment routes (but /mine still works)", async () => {
    const teacher = await createTeacherSession(app);

    expect((await teacher.agent.get("/api/staff")).status).toBe(403);
    expect((await teacher.agent.get("/api/teacher-assignments")).status).toBe(403);
    expect((await teacher.agent.get("/api/teacher-assignments/mine")).status).toBe(200);
  });

  test("archiving a staff member hides their active assignments", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const { klass, section, subject, session } = await createAcademicChain();
    const staffRes = await withCsrf(agent.post("/api/staff").send({ fullName: "Has Assignment" }), csrfToken);

    await withCsrf(
      agent.post("/api/teacher-assignments").send({
        teacher: staffRes.body._id,
        class: klass._id,
        section: section._id,
        subject: subject._id,
        academicSession: session._id,
      }),
      csrfToken
    );

    const archiveRes = await withCsrf(agent.delete(`/api/staff/${staffRes.body._id}`).send({ adminPassword: "Password123!", reason: "Employment ended" }), csrfToken);
    expect(archiveRes.status).toBe(200);
    expect((await agent.get(`/api/staff/${staffRes.body._id}`)).status).toBe(404);
    const assignments = await agent.get("/api/teacher-assignments");
    expect(assignments.body.items).toHaveLength(0);
  });

  test("assigning a teacher that doesn't exist is rejected, not silently created", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const { klass, section, subject, session } = await createAcademicChain();
    const fakeStaffId = new mongoose.Types.ObjectId().toString();

    const res = await withCsrf(
      agent.post("/api/teacher-assignments").send({
        teacher: fakeStaffId,
        class: klass._id,
        section: section._id,
        subject: subject._id,
        academicSession: session._id,
      }),
      csrfToken
    );

    expect(res.status).toBe(400);
  });
});
