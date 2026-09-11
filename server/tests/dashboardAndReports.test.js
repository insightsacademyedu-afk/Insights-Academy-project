import app from "../app.js";
import FeeInvoice, { computeInvoiceTotal } from "../models/FeeInvoice.js";
import { createAdminSession, createTeacherSession, withCsrf } from "./helpers/authHelpers.js";
import { createAcademicChain, createEnrolledStudent, assignTeacher } from "./helpers/fixtures.js";

async function makeInvoice({ student, academicSession }, overrides = {}) {
  const fields = {
    monthlyTuition: overrides.monthlyTuition ?? 5000,
    admissionFee: overrides.admissionFee ?? 0,
    examFee: overrides.examFee ?? 0,
    otherFee: overrides.otherFee ?? 0,
    discount: overrides.discount ?? 0,
    scholarship: overrides.scholarship ?? 0,
  };
  const invoice = new FeeInvoice({
    student: student._id,
    academicSession: academicSession._id,
    period: overrides.period || `2026-${String(Math.floor(Math.random() * 12) + 1).padStart(2, "0")}`,
    invoiceType: "tuition",
    dueDate: overrides.dueDate || new Date("2026-06-01"),
    ...fields,
    totalAmount: computeInvoiceTotal(fields),
  });
  if (overrides.amountPaid) invoice.amountPaid = overrides.amountPaid;
  if (overrides.status) {
    invoice.status = overrides.status; // e.g. "waived" — bypass recomputeStatus's normal derivation
  } else {
    invoice.recomputeStatus();
  }
  await invoice.save();
  return invoice;
}

describe("Phase 9 — Dashboard & Reports", () => {
  test("admin-summary's fee totals match manual sums, and outstanding excludes waived invoices", async () => {
    const { agent } = await createAdminSession(app);
    const { session, klass, section } = await createAcademicChain();
    const { student: studentA } = await createEnrolledStudent({ klass, section, session });
    const { student: studentB } = await createEnrolledStudent({ klass, section, session });

    // Unpaid invoice: fully outstanding.
    await makeInvoice({ student: studentA, academicSession: session }, { monthlyTuition: 5000 });
    // Partially paid invoice.
    await makeInvoice({ student: studentB, academicSession: session }, { monthlyTuition: 4000, amountPaid: 1500 });
    // Waived invoice with an unpaid balance — this is the case that used
    // to make admin-summary's outstanding disagree with the report's.
    await makeInvoice(
      { student: studentA, academicSession: session },
      { monthlyTuition: 3000, amountPaid: 0, status: "waived", period: "2026-99-waived" }
    );

    const res = await agent.get("/api/dashboard/admin-summary");
    expect(res.status).toBe(200);

    // totalBilled/totalCollected still include every invoice, waived or not.
    expect(res.body.fees.totalBilled).toBe(5000 + 4000 + 3000);
    expect(res.body.fees.totalCollected).toBe(0 + 1500 + 0);
    expect(res.body.fees.invoiceCount).toBe(3);

    // outstanding excludes the waived invoice's unpaid balance entirely:
    // (5000-0) + (4000-1500) + 0(waived, excluded) = 7500, NOT 7500+3000.
    expect(res.body.fees.outstanding).toBe(7500);
  });

  test("outstanding-fees report total matches the dashboard summary's outstanding total for the same data", async () => {
    const { agent } = await createAdminSession(app);
    const { session, klass, section } = await createAcademicChain();
    const { student: studentA } = await createEnrolledStudent({ klass, section, session });
    const { student: studentB } = await createEnrolledStudent({ klass, section, session });

    await makeInvoice({ student: studentA, academicSession: session }, { monthlyTuition: 6000, amountPaid: 2000 });
    await makeInvoice(
      { student: studentB, academicSession: session },
      { monthlyTuition: 2500, amountPaid: 0, status: "waived", period: "2026-98-waived" }
    );

    const summaryRes = await agent.get("/api/dashboard/admin-summary");
    const reportRes = await agent.get("/api/reports/outstanding-fees");

    expect(summaryRes.status).toBe(200);
    expect(reportRes.status).toBe(200);
    expect(reportRes.body.totalOutstanding).toBe(summaryRes.body.fees.outstanding);
    expect(reportRes.body.totalOutstanding).toBe(4000); // 6000-2000, waived excluded entirely
  });

  test("teacher-summary as a teacher shows only their own assigned student count", async () => {
    const { session, klass, section, subject } = await createAcademicChain();
    const { session: otherSession, klass: otherKlass, section: otherSection } = await createAcademicChain();

    const { agent: teacherAgent, staff: teacher } = await createTeacherSession(app);
    await assignTeacher({ klass, section, subject, session }, teacher._id);

    // Two students in the teacher's own class/section...
    await createEnrolledStudent({ klass, section, session });
    await createEnrolledStudent({ klass, section, session });
    // ...and one in a completely unrelated class/section the teacher has no assignment for.
    await createEnrolledStudent({ klass: otherKlass, section: otherSection, session: otherSession });

    const res = await teacherAgent.get("/api/dashboard/teacher-summary");
    expect(res.status).toBe(200);
    expect(res.body.studentCount).toBe(2);
  });

  test("students report CSV export handles a guardian name containing a comma", async () => {
    const { agent } = await createAdminSession(app);
    const { session, klass, section } = await createAcademicChain();
    await createEnrolledStudent({ klass, section, session }, { guardianName: "Doe, John" });

    const res = await agent.get("/api/reports/students?format=csv");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text).toContain('"Doe, John"');
  });

  test("a staff (non-admin) user gets 403 on every /api/reports/* route and on admin-summary", async () => {
    const { agent: teacherAgent } = await createTeacherSession(app);

    const reportsRes = await teacherAgent.get("/api/reports/students");
    expect(reportsRes.status).toBe(403);

    const outstandingRes = await teacherAgent.get("/api/reports/outstanding-fees");
    expect(outstandingRes.status).toBe(403);

    const expensesRes = await teacherAgent.get("/api/reports/expenses");
    expect(expensesRes.status).toBe(403);

    const summaryRes = await teacherAgent.get("/api/dashboard/admin-summary");
    expect(summaryRes.status).toBe(403);
  });
});
