import app from "../app.js";
import Guardian from "../models/Guardian.js";
import Student from "../models/Student.js";
import StudentClassAssignment from "../models/StudentClassAssignment.js";
import FeeInvoice from "../models/FeeInvoice.js";
import { createAdminSession, createTeacherSession, withCsrf } from "./helpers/authHelpers.js";
import { createAcademicChain } from "./helpers/fixtures.js";

function studentPayload(overrides = {}) {
  return {
    admissionNumber: overrides.admissionNumber || `ADM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    fullName: "Test Student",
    gender: "male",
    dob: "2015-05-01",
    guardian: {
      fullName: "Test Guardian",
      primaryPhone: "03001234567",
    },
    enrollment: {
      class: overrides.classId,
      section: overrides.sectionId,
      academicSession: overrides.sessionId,
      rollNumber: overrides.rollNumber || "1",
    },
    feeDetails: { monthlyTuition: 5000 },
  };
}

describe("Phase 4 — Student & Guardian management", () => {
  test("enrolling a student creates Guardian + Student + StudentClassAssignment together (transaction)", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const { klass, section, session } = await createAcademicChain();

    const payload = studentPayload({ classId: klass._id, sectionId: section._id, sessionId: session._id });
    const res = await withCsrf(agent.post("/api/students").send(payload), csrfToken);

    expect(res.status).toBe(201);
    expect(res.body.student).toBeTruthy();
    expect(res.body.guardian).toBeTruthy();
    expect(res.body.assignment).toBeTruthy();

    expect(await Guardian.countDocuments({})).toBe(1);
    expect(await Student.countDocuments({})).toBe(1);
    expect(await StudentClassAssignment.countDocuments({})).toBe(1);
  });

  test("a duplicate roll number in the same class/section/session fails with 409, and leaves NO partial records behind", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const { klass, section, session } = await createAcademicChain();

    const first = studentPayload({ classId: klass._id, sectionId: section._id, sessionId: session._id, rollNumber: "7" });
    const firstRes = await withCsrf(agent.post("/api/students").send(first), csrfToken);
    expect(firstRes.status).toBe(201);

    const second = studentPayload({ classId: klass._id, sectionId: section._id, sessionId: session._id, rollNumber: "7" });
    const secondRes = await withCsrf(agent.post("/api/students").send(second), csrfToken);
    expect(secondRes.status).toBe(409);

    // The transaction must have rolled back completely: only the first
    // student's guardian/student/assignment records should exist.
    expect(await Guardian.countDocuments({})).toBe(1);
    expect(await Student.countDocuments({})).toBe(1);
    expect(await StudentClassAssignment.countDocuments({})).toBe(1);
  });

  test("a teacher assigned to Class9/SectionA can list/view students there, and gets 403 on a student in Class10/SectionB (IDOR guard)", async () => {
    const { agent: adminAgent, csrfToken } = await createAdminSession(app);
    const chainA = await createAcademicChain({ className: "9th", sectionName: "A" });
    const chainB = await createAcademicChain({ className: "10th", sectionName: "B" });
    const teacher = await createTeacherSession(app, { fullName: "Scoped Teacher" });

    await withCsrf(
      adminAgent.post("/api/teacher-assignments").send({
        teacher: teacher.staff._id,
        class: chainA.klass._id,
        section: chainA.section._id,
        subject: chainA.subject._id,
        academicSession: chainA.session._id,
      }),
      csrfToken
    );

    const studentA = await withCsrf(
      adminAgent.post("/api/students").send(
        studentPayload({ classId: chainA.klass._id, sectionId: chainA.section._id, sessionId: chainA.session._id })
      ),
      csrfToken
    );
    const studentB = await withCsrf(
      adminAgent.post("/api/students").send(
        studentPayload({ classId: chainB.klass._id, sectionId: chainB.section._id, sessionId: chainB.session._id })
      ),
      csrfToken
    );

    const idA = studentA.body.student._id;
    const idB = studentB.body.student._id;

    // Teacher can see their own scoped student...
    const viewA = await teacher.agent.get(`/api/students/${idA}`);
    expect(viewA.status).toBe(200);

    // ...but hitting a student outside their assignment by ID (the exact
    // IDOR scenario from the spec) must 403, not silently succeed.
    const viewB = await teacher.agent.get(`/api/students/${idB}`);
    expect(viewB.status).toBe(403);

    // The list endpoint must be scoped server-side too, not just the detail route.
    const listRes = await teacher.agent.get("/api/students");
    expect(listRes.status).toBe(200);
    const ids = listRes.body.items.map((s) => s._id);
    expect(ids).toContain(idA);
    expect(ids).not.toContain(idB);
  });

  test("a teacher's view of a student never includes feeDetails, totalPayable, or cnicOrBForm; admin's view does", async () => {
    const { agent: adminAgent, csrfToken } = await createAdminSession(app);
    const { klass, section, subject, session } = await createAcademicChain();
    const teacher = await createTeacherSession(app);

    await withCsrf(
      adminAgent.post("/api/teacher-assignments").send({
        teacher: teacher.staff._id,
        class: klass._id,
        section: section._id,
        subject: subject._id,
        academicSession: session._id,
      }),
      csrfToken
    );

    const studentRes = await withCsrf(
      adminAgent.post("/api/students").send(
        studentPayload({ classId: klass._id, sectionId: section._id, sessionId: session._id })
      ),
      csrfToken
    );
    const id = studentRes.body.student._id;

    const teacherView = await teacher.agent.get(`/api/students/${id}`);
    expect(teacherView.status).toBe(200);
    expect(teacherView.body.student.feeDetails).toBeUndefined();
    expect(teacherView.body.student.totalPayable).toBeUndefined();
    expect(teacherView.body.student.cnicOrBForm).toBeUndefined();

    const adminView = await adminAgent.get(`/api/students/${id}`);
    expect(adminView.status).toBe(200);
    expect(adminView.body.student.feeDetails).toBeTruthy();
    expect(adminView.body.student.totalPayable).toBeDefined();
  });

  test("a teacher with NO assignments at all gets an empty student list, never an unfiltered one", async () => {
    const { agent: adminAgent, csrfToken } = await createAdminSession(app);
    const { klass, section, session } = await createAcademicChain();
    const unassignedTeacher = await createTeacherSession(app, { fullName: "No Assignments" });

    await withCsrf(
      adminAgent.post("/api/students").send(
        studentPayload({ classId: klass._id, sectionId: section._id, sessionId: session._id })
      ),
      csrfToken
    );

    const res = await unassignedTeacher.agent.get("/api/students");
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(0);
  });

  test("students can be safely archived while fee invoices are preserved", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const { klass, section, session } = await createAcademicChain();

    const withInvoiceRes = await withCsrf(
      agent.post("/api/students").send(studentPayload({ classId: klass._id, sectionId: section._id, sessionId: session._id, rollNumber: "1" })),
      csrfToken
    );
    const noInvoiceRes = await withCsrf(
      agent.post("/api/students").send(studentPayload({ classId: klass._id, sectionId: section._id, sessionId: session._id, rollNumber: "2" })),
      csrfToken
    );

    await FeeInvoice.create({
      student: withInvoiceRes.body.student._id,
      academicSession: session._id,
      period: "2026-01",
      totalAmount: 5000,
      dueDate: new Date(),
    });

    const firstArchive = await withCsrf(agent.delete(`/api/students/${withInvoiceRes.body.student._id}`).send({ adminPassword: "Password123!", reason: "Student left academy" }), csrfToken);
    expect(firstArchive.status).toBe(200);
    expect((await agent.get(`/api/students/${withInvoiceRes.body.student._id}`)).status).toBe(404);
    expect(await FeeInvoice.countDocuments({ student: withInvoiceRes.body.student._id })).toBe(1);

    const secondArchive = await withCsrf(agent.delete(`/api/students/${noInvoiceRes.body.student._id}`).send({ adminPassword: "Password123!", reason: "Duplicate enrollment" }), csrfToken);
    expect(secondArchive.status).toBe(200);
  });

  test("enrolling without guardian or enrollment details is rejected with 400", async () => {
    const { agent, csrfToken } = await createAdminSession(app);

    const res = await withCsrf(
      agent.post("/api/students").send({
        admissionNumber: "ADM-BAD",
        fullName: "No Guardian",
        gender: "male",
        dob: "2015-01-01",
      }),
      csrfToken
    );

    expect(res.status).toBe(400);
  });
});
