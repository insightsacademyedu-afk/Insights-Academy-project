import app from "../app.js";
import FeeInvoice from "../models/FeeInvoice.js";
import FeePayment from "../models/FeePayment.js";
import { createAdminSession, createTeacherSession, withCsrf } from "./helpers/authHelpers.js";
import { createAcademicChain, createEnrolledStudent } from "./helpers/fixtures.js";

// Invoice due dates in these tests only need to be "in the future" relative
// to whenever the suite runs (recomputeStatus() derives "overdue" from
// dueDate vs the real clock) — a fixed calendar date eventually becomes
// the past. Generate one far enough out to stay future indefinitely.
function futureDueDate(daysAhead = 365) {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe("Phase 5 — Fees module", () => {
  test("admin creates a single invoice for a student; totalAmount matches computeInvoiceTotal", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const chain = await createAcademicChain();
    const { student } = await createEnrolledStudent(chain, {
      feeDetails: { monthlyTuition: 5000, admissionFee: 1000, discount: 500 },
    });

    const res = await withCsrf(
      agent.post("/api/fees/invoices").send({
        student: student._id,
        academicSession: chain.session._id,
        period: "2026-01",
        invoiceType: "tuition",
        dueDate: futureDueDate(),
      }),
      csrfToken
    );

    expect(res.status).toBe(201);
    // Monthly tuition 5000 - discount 500 = 4500; admission is billed separately.
    expect(res.body.totalAmount).toBe(4500); // tuition does not automatically repeat the admission charge
    expect(res.body.status).toBe("unpaid");
  });

  test("creating an invoice referencing a fake academicSession id is rejected with 400, not 500", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const chain = await createAcademicChain();
    const { student } = await createEnrolledStudent(chain);
    const fakeSessionId = "64b000000000000000000000";

    const res = await withCsrf(
      agent.post("/api/fees/invoices").send({
        student: student._id,
        academicSession: fakeSessionId,
        period: "2026-01",
        dueDate: futureDueDate(),
      }),
      csrfToken
    );

    expect(res.status).toBe(400);
  });

  test("a duplicate invoice for the same student/period/type is rejected with 409", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const chain = await createAcademicChain();
    const { student } = await createEnrolledStudent(chain);

    const payload = {
      student: student._id,
      academicSession: chain.session._id,
      period: "2026-02",
      invoiceType: "tuition",
      dueDate: futureDueDate(),
    };

    const first = await withCsrf(agent.post("/api/fees/invoices").send(payload), csrfToken);
    expect(first.status).toBe(201);

    const second = await withCsrf(agent.post("/api/fees/invoices").send(payload), csrfToken);
    expect(second.status).toBe(409);
  });

  test("bulk-generating tuition invoices for a class/section skips students who already have one for that period", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const chain = await createAcademicChain();
    await createEnrolledStudent(chain, { rollNumber: "1", admissionNumber: "ADM-BULK-1" });
    await createEnrolledStudent(chain, { rollNumber: "2", admissionNumber: "ADM-BULK-2" });

    const payload = {
      class: chain.klass._id,
      section: chain.section._id,
      academicSession: chain.session._id,
      period: "2026-03",
      dueDate: futureDueDate(),
    };

    const first = await withCsrf(agent.post("/api/fees/invoices/bulk-generate").send(payload), csrfToken);
    expect(first.status).toBe(201);
    expect(first.body.createdCount).toBe(2);
    expect(first.body.skippedCount).toBe(0);

    // Re-running for the same period should skip both, not fail the batch.
    const second = await withCsrf(agent.post("/api/fees/invoices/bulk-generate").send(payload), csrfToken);
    expect(second.status).toBe(201);
    expect(second.body.createdCount).toBe(0);
    expect(second.body.skippedCount).toBe(2);

    expect(await FeeInvoice.countDocuments({ period: "2026-03" })).toBe(2);
  });

  test("recording a payment smaller than the total sets status to partially_paid; paying the remainder sets it to paid", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const chain = await createAcademicChain();
    const { student } = await createEnrolledStudent(chain, { feeDetails: { monthlyTuition: 10000 } });

    const invoiceRes = await withCsrf(
      agent.post("/api/fees/invoices").send({
        student: student._id,
        academicSession: chain.session._id,
        period: "2026-04",
        dueDate: futureDueDate(),
      }),
      csrfToken
    );
    const invoiceId = invoiceRes.body._id;

    const partial = await withCsrf(
      agent.post("/api/fees/payments").send({ invoice: invoiceId, amount: 4000, method: "cash" }),
      csrfToken
    );
    expect(partial.status).toBe(201);
    expect(partial.body.invoice.status).toBe("partially_paid");
    expect(partial.body.invoice.amountPaid).toBe(4000);

    const remainder = await withCsrf(
      agent.post("/api/fees/payments").send({ invoice: invoiceId, amount: 6000, method: "cash" }),
      csrfToken
    );
    expect(remainder.status).toBe(201);
    expect(remainder.body.invoice.status).toBe("paid");
    expect(remainder.body.invoice.amountPaid).toBe(10000);
  });

  test("attempting to pay more than the remaining balance is rejected with 400 and leaves amountPaid unchanged", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const chain = await createAcademicChain();
    const { student } = await createEnrolledStudent(chain, { feeDetails: { monthlyTuition: 3000 } });

    const invoiceRes = await withCsrf(
      agent.post("/api/fees/invoices").send({
        student: student._id,
        academicSession: chain.session._id,
        period: "2026-05",
        dueDate: futureDueDate(),
      }),
      csrfToken
    );
    const invoiceId = invoiceRes.body._id;

    const overpay = await withCsrf(
      agent.post("/api/fees/payments").send({ invoice: invoiceId, amount: 5000, method: "cash" }),
      csrfToken
    );
    expect(overpay.status).toBe(400);

    const invoice = await FeeInvoice.findById(invoiceId);
    expect(invoice.amountPaid).toBe(0);
    expect(invoice.status).toBe("unpaid");
    expect(await FeePayment.countDocuments({ invoice: invoiceId })).toBe(0);
  });

  test("two payments recorded back-to-back get two different, sequential receipt numbers", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const chain = await createAcademicChain();
    const { student } = await createEnrolledStudent(chain, { feeDetails: { monthlyTuition: 10000 } });

    const invoiceRes = await withCsrf(
      agent.post("/api/fees/invoices").send({
        student: student._id,
        academicSession: chain.session._id,
        period: "2026-06",
        dueDate: futureDueDate(),
      }),
      csrfToken
    );
    const invoiceId = invoiceRes.body._id;

    const p1 = await withCsrf(
      agent.post("/api/fees/payments").send({ invoice: invoiceId, amount: 1000, method: "cash" }),
      csrfToken
    );
    const p2 = await withCsrf(
      agent.post("/api/fees/payments").send({ invoice: invoiceId, amount: 1000, method: "cash" }),
      csrfToken
    );

    expect(p1.body.payment.receiptNumber).toBeTruthy();
    expect(p2.body.payment.receiptNumber).toBeTruthy();
    expect(p1.body.payment.receiptNumber).not.toBe(p2.body.payment.receiptNumber);
  });

  test("a fully-discounted invoice (totalAmount 0) is created with status paid, not unpaid", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const chain = await createAcademicChain();
    const { student } = await createEnrolledStudent(chain, {
      feeDetails: { monthlyTuition: 5000, scholarship: 5000 },
    });

    const res = await withCsrf(
      agent.post("/api/fees/invoices").send({
        student: student._id,
        academicSession: chain.session._id,
        period: "2026-07",
        dueDate: futureDueDate(),
      }),
      csrfToken
    );

    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(0);
    expect(res.body.status).toBe("paid");
  });

  test("archiving a student keeps the invoice on file", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const chain = await createAcademicChain();
    const { student } = await createEnrolledStudent(chain);

    await withCsrf(
      agent.post("/api/fees/invoices").send({
        student: student._id,
        academicSession: chain.session._id,
        period: "2026-08",
        dueDate: futureDueDate(),
      }),
      csrfToken
    );

    const archived = await withCsrf(agent.delete(`/api/students/${student._id}`).send({ adminPassword: "Password123!", reason: "Student left academy" }), csrfToken);
    expect(archived.status).toBe(200);
    expect(await FeeInvoice.countDocuments({ student: student._id })).toBe(1);
  });

  test("waiving an invoice sets status to waived and appends the reason to notes", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const chain = await createAcademicChain();
    const { student } = await createEnrolledStudent(chain, {
      feeDetails: { monthlyTuition: 5000 },
    });

    const invoiceRes = await withCsrf(
      agent.post("/api/fees/invoices").send({
        student: student._id,
        academicSession: chain.session._id,
        period: "2026-09",
        dueDate: futureDueDate(),
      }),
      csrfToken
    );

    const waiveRes = await withCsrf(
      agent.patch(`/api/fees/invoices/${invoiceRes.body._id}/waive`).send({ reason: "financial hardship" }),
      csrfToken
    );

    expect(waiveRes.status).toBe(200);
    expect(waiveRes.body.status).toBe("waived");
    expect(waiveRes.body.notes).toContain("financial hardship");

    // Sticky per recomputeStatus() — a payment recorded afterward must not
    // un-waive it.
    const fresh = await FeeInvoice.findById(invoiceRes.body._id);
    fresh.recomputeStatus();
    expect(fresh.status).toBe("waived");
  });

  test("waiving an already-waived invoice returns 409; waiving a fully-paid invoice returns 400", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const chain = await createAcademicChain();
    const { student } = await createEnrolledStudent(chain, {
      feeDetails: { monthlyTuition: 1000 },
    });

    const invoiceRes = await withCsrf(
      agent.post("/api/fees/invoices").send({
        student: student._id,
        academicSession: chain.session._id,
        period: "2026-10",
        dueDate: futureDueDate(),
      }),
      csrfToken
    );

    const firstWaive = await withCsrf(
      agent.patch(`/api/fees/invoices/${invoiceRes.body._id}/waive`).send({}),
      csrfToken
    );
    expect(firstWaive.status).toBe(200);

    const secondWaive = await withCsrf(
      agent.patch(`/api/fees/invoices/${invoiceRes.body._id}/waive`).send({}),
      csrfToken
    );
    expect(secondWaive.status).toBe(409);

    const { student: paidStudent } = await createEnrolledStudent(chain, {
      feeDetails: { monthlyTuition: 1000 },
    });
    const paidInvoiceRes = await withCsrf(
      agent.post("/api/fees/invoices").send({
        student: paidStudent._id,
        academicSession: chain.session._id,
        period: "2026-10",
        dueDate: futureDueDate(),
      }),
      csrfToken
    );
    await withCsrf(
      agent.post("/api/fees/payments").send({
        invoice: paidInvoiceRes.body._id,
        amount: 1000,
        method: "cash",
      }),
      csrfToken
    );

    const waivePaid = await withCsrf(
      agent.patch(`/api/fees/invoices/${paidInvoiceRes.body._id}/waive`).send({}),
      csrfToken
    );
    expect(waivePaid.status).toBe(400);
  });

  test("a staff-role user gets 403 on every /api/fees/* route", async () => {
    const { agent, csrfToken } = await createTeacherSession(app);

    const list = await agent.get("/api/fees/invoices");
    expect(list.status).toBe(403);

    const create = await withCsrf(
      agent.post("/api/fees/invoices").send({
        student: "64b000000000000000000000",
        academicSession: "64b000000000000000000000",
        period: "2026-01",
        dueDate: futureDueDate(),
      }),
      csrfToken
    );
    expect(create.status).toBe(403);

    const pay = await withCsrf(
      agent.post("/api/fees/payments").send({ invoice: "64b000000000000000000000", amount: 100, method: "cash" }),
      csrfToken
    );
    expect(pay.status).toBe(403);

    const waive = await withCsrf(
      agent.patch("/api/fees/invoices/64b000000000000000000000/waive").send({}),
      csrfToken
    );
    expect(waive.status).toBe(403);
  });
});
