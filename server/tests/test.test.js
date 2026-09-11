import app from "../app.js";
import Test from "../models/Test.js";
import TestResult from "../models/TestResult.js";
import { createAdminSession, createTeacherSession, withCsrf } from "./helpers/authHelpers.js";
import { createAcademicChain, createEnrolledStudent, assignTeacher } from "./helpers/fixtures.js";

function testPayload(chain, overrides = {}) {
  return {
    title: "Midterm",
    class: chain.klass._id,
    section: chain.section._id,
    subject: chain.subject._id,
    academicSession: chain.session._id,
    maxMarks: 100,
    passingMarks: 40,
    testDate: "2026-03-15",
    ...overrides,
  };
}

describe("Phase 6 — Tests, Exams & Academic Records", () => {
  test("a teacher assigned to a class/section/subject can create a test for it", async () => {
    const { agent, csrfToken, staff } = await createTeacherSession(app);
    const chain = await createAcademicChain();
    await assignTeacher(chain, staff._id);

    const res = await withCsrf(agent.post("/api/tests").send(testPayload(chain)), csrfToken);

    expect(res.status).toBe(201);
    expect(String(res.body.createdBy)).toBe(String(staff._id));
    expect(res.body.status).toBe("draft");
  });

  test("a teacher NOT assigned to the class/subject gets 403 creating a test there", async () => {
    const { agent, csrfToken } = await createTeacherSession(app);
    const chain = await createAcademicChain();
    // Deliberately no assignTeacher() call — this teacher has no assignments at all.

    const res = await withCsrf(agent.post("/api/tests").send(testPayload(chain)), csrfToken);

    expect(res.status).toBe(403);
  });

  test("an admin creating a test with a fake subject id is rejected with 400, not 500", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const chain = await createAcademicChain();
    const { staff } = await createTeacherSession(app);

    const res = await withCsrf(
      agent
        .post("/api/tests")
        .send(testPayload(chain, { subject: "64b000000000000000000000", createdBy: staff._id })),
      csrfToken
    );

    expect(res.status).toBe(400);
  });

  test("an admin creating a test with a section that doesn't belong to the given class is rejected with 400", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const chain = await createAcademicChain();
    const otherChain = await createAcademicChain({ className: "9th", sectionName: "Z" });
    const { staff } = await createTeacherSession(app);

    const res = await withCsrf(
      agent
        .post("/api/tests")
        .send(testPayload(chain, { section: otherChain.section._id, createdBy: staff._id })),
      csrfToken
    );

    expect(res.status).toBe(400);
  });

  test("a teacher entering marks for a student not enrolled in that class/section gets 400", async () => {
    const { agent, csrfToken, staff } = await createTeacherSession(app);
    const chain = await createAcademicChain();
    await assignTeacher(chain, staff._id);

    const createRes = await withCsrf(agent.post("/api/tests").send(testPayload(chain)), csrfToken);
    const testId = createRes.body._id;

    // A student who exists, but was never enrolled via StudentClassAssignment
    // in this class/section.
    const otherChain = await createAcademicChain({ className: "9th", sectionName: "Z" });
    const { student: unenrolledStudent } = await createEnrolledStudent(otherChain);

    const res = await withCsrf(
      agent.post(`/api/tests/${testId}/marks`).send({
        entries: [{ student: unenrolledStudent._id, marksObtained: 80 }],
      }),
      csrfToken
    );

    expect(res.status).toBe(400);
  });

  test("full draft -> finalize -> amend workflow", async () => {
    const { agent, csrfToken, staff } = await createTeacherSession(app);
    const chain = await createAcademicChain();
    await assignTeacher(chain, staff._id);
    const { student } = await createEnrolledStudent(chain);

    const createRes = await withCsrf(agent.post("/api/tests").send(testPayload(chain)), csrfToken);
    const testId = createRes.body._id;

    const enterRes = await withCsrf(
      agent.post(`/api/tests/${testId}/marks`).send({
        entries: [{ student: student._id, marksObtained: 55 }],
      }),
      csrfToken
    );
    expect(enterRes.status).toBe(200);
    expect(enterRes.body.savedCount).toBe(1);

    const finalizeRes = await withCsrf(agent.post(`/api/tests/${testId}/finalize`).send({}), csrfToken);
    expect(finalizeRes.status).toBe(200);
    expect(finalizeRes.body.status).toBe("finalized");

    // enterMarks is blocked once finalized -> must use amend instead.
    const reEnterRes = await withCsrf(
      agent.post(`/api/tests/${testId}/marks`).send({
        entries: [{ student: student._id, marksObtained: 60 }],
      }),
      csrfToken
    );
    expect(reEnterRes.status).toBe(409);

    const amendRes = await withCsrf(
      agent.post(`/api/tests/${testId}/amend`).send({
        student: student._id,
        newMarks: 60,
        reason: "Re-checked answer sheet",
      }),
      csrfToken
    );
    expect(amendRes.status).toBe(200);
    expect(amendRes.body.marksObtained).toBe(60);
    expect(amendRes.body.amendments).toHaveLength(1);
    expect(amendRes.body.amendments[0].previousMarks).toBe(55);
    expect(amendRes.body.amendments[0].newMarks).toBe(60);

    const stored = await TestResult.findOne({ test: testId, student: student._id });
    expect(stored.marksObtained).toBe(60);
    expect(stored.amendments).toHaveLength(1);
  });

  test("a second, unrelated teacher gets 403 viewing/editing the first teacher's test, even teaching the same subject", async () => {
    const { agent: teacherAAgent, csrfToken: teacherACsrf, staff: teacherA } = await createTeacherSession(app, {
      fullName: "Teacher A",
    });
    const chain = await createAcademicChain();
    await assignTeacher(chain, teacherA._id);

    const createRes = await withCsrf(teacherAAgent.post("/api/tests").send(testPayload(chain)), teacherACsrf);
    const testId = createRes.body._id;

    // Teacher B is assigned to the SAME class/section/subject, but did not
    // create this test.
    const { agent: teacherBAgent, csrfToken: teacherBCsrf, staff: teacherB } = await createTeacherSession(app, {
      fullName: "Teacher B",
    });
    await assignTeacher(chain, teacherB._id);

    const getRes = await teacherBAgent.get(`/api/tests/${testId}`);
    expect(getRes.status).toBe(403);

    const finalizeRes = await withCsrf(teacherBAgent.post(`/api/tests/${testId}/finalize`).send({}), teacherBCsrf);
    expect(finalizeRes.status).toBe(403);
  });

  test("an admin can view/finalize/amend any teacher's test", async () => {
    const { agent: teacherAgent, csrfToken: teacherCsrf, staff } = await createTeacherSession(app);
    const chain = await createAcademicChain();
    await assignTeacher(chain, staff._id);
    const { student } = await createEnrolledStudent(chain);

    const createRes = await withCsrf(teacherAgent.post("/api/tests").send(testPayload(chain)), teacherCsrf);
    const testId = createRes.body._id;

    await withCsrf(
      teacherAgent.post(`/api/tests/${testId}/marks`).send({ entries: [{ student: student._id, marksObtained: 70 }] }),
      teacherCsrf
    );

    const { agent: adminAgent, csrfToken: adminCsrf } = await createAdminSession(app);

    const getRes = await adminAgent.get(`/api/tests/${testId}`);
    expect(getRes.status).toBe(200);

    const finalizeRes = await withCsrf(adminAgent.post(`/api/tests/${testId}/finalize`).send({}), adminCsrf);
    expect(finalizeRes.status).toBe(200);

    const amendRes = await withCsrf(
      adminAgent.post(`/api/tests/${testId}/amend`).send({ student: student._id, newMarks: 75, reason: "Admin correction" }),
      adminCsrf
    );
    expect(amendRes.status).toBe(200);
    expect(amendRes.body.marksObtained).toBe(75);
  });

  test("marksObtained exceeding maxMarks is rejected with 400", async () => {
    const { agent, csrfToken, staff } = await createTeacherSession(app);
    const chain = await createAcademicChain();
    await assignTeacher(chain, staff._id);
    const { student } = await createEnrolledStudent(chain);

    const createRes = await withCsrf(agent.post("/api/tests").send(testPayload(chain, { maxMarks: 50 })), csrfToken);
    const testId = createRes.body._id;

    const res = await withCsrf(
      agent.post(`/api/tests/${testId}/marks`).send({
        entries: [{ student: student._id, marksObtained: 999 }],
      }),
      csrfToken
    );

    expect(res.status).toBe(400);
    expect(await TestResult.countDocuments({ test: testId })).toBe(0);
  });

  test("passingMarks greater than maxMarks is rejected with 400", async () => {
    const { agent, csrfToken, staff } = await createTeacherSession(app);
    const chain = await createAcademicChain();
    await assignTeacher(chain, staff._id);

    const res = await withCsrf(
      agent.post("/api/tests").send(testPayload(chain, { maxMarks: 50, passingMarks: 80 })),
      csrfToken
    );

    expect(res.status).toBe(400);
    expect(await Test.countDocuments({})).toBe(0);
  });
});
