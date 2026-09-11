import app from "../app.js";
import Notification from "../models/Notification.js";
import NotificationRecipient from "../models/NotificationRecipient.js";
import Guardian from "../models/Guardian.js";
import Staff from "../models/Staff.js";
import { createAdminSession, createTeacherSession, withCsrf } from "./helpers/authHelpers.js";
import { createAcademicChain, createEnrolledStudent } from "./helpers/fixtures.js";

describe("Phase 8 — Notification System", () => {
  test("two students sharing one guardian email each get only ONE recipient row for that destination/channel", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const { session, klass, section } = await createAcademicChain();

    // Two separate guardian documents that happen to share one email
    // address (e.g. one parent registered as both contacts) — dedup is
    // by destination, not by guardian id, so this must still collapse
    // to a single row.
    const sharedEmail = `shared-${Date.now()}@example.com`;
    await createEnrolledStudent(
      { klass, section, session },
      { guardianPhone: "03001234567", fullName: "Student One" }
    );
    await createEnrolledStudent(
      { klass, section, session },
      { guardianPhone: "03007654321", fullName: "Student Two" }
    );
    // Backfill both guardians with the same email after creation, since
    // createEnrolledStudent's fixture doesn't take an email override.
    const guardians = await Guardian.find({}).sort({ createdAt: 1 });
    await Guardian.updateMany({ _id: { $in: guardians.map((g) => g._id) } }, { $set: { email: sharedEmail } });

    const res = await withCsrf(
      agent.post("/api/notifications").send({
        title: "Shared-contact test",
        body: "Should only send once per destination",
        channels: ["email"],
        audience: { type: "class_section", classId: klass._id, sectionId: section._id, academicSession: session._id },
      }),
      csrfToken
    );

    expect(res.status).toBe(201);
    expect(res.body.recipientCount).toBe(1);

    const rows = await NotificationRecipient.find({ notification: res.body.notification._id });
    expect(rows.length).toBe(1);
    expect(rows[0].destination).toBe(sharedEmail);
  });

  test("a channel with no contact info on file is skipped (absent), not created as a failed row", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const guardian = await Guardian.create({
      fullName: "No Email Guardian",
      primaryPhone: "03009999999",
      email: "", // no email on file
    });

    const res2 = await withCsrf(
      agent.post("/api/notifications").send({
        title: "Mixed channel test 2",
        body: "SMS should send (well, attempt), email should be skipped entirely",
        channels: ["sms", "email"],
        audience: { type: "all_guardians" },
      }),
      csrfToken
    );

    expect(res2.status).toBe(201);

    const rows = await NotificationRecipient.find({
      notification: res2.body.notification._id,
      recipientId: guardian._id,
    });
    const channelsPresent = rows.map((r) => r.channel).sort();
    expect(channelsPresent).toEqual(["sms"]); // no email row at all, not a failed one

    const smsRow = rows.find((r) => r.channel === "sms");
    expect(smsRow.status).toBe("failed"); // SMS provider is a stub — attempted, but fails cleanly
    expect(smsRow.destination).toBe("03009999999");
  });

  test("GET /api/notifications/:id shows an accurate deliverySummary", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const staff = await Staff.create({ fullName: "In-App Recipient", status: "active" });

    const createRes = await withCsrf(
      agent.post("/api/notifications").send({
        title: "In-app only",
        body: "Always succeeds — in-app has no external delivery step",
        channels: ["in_app"],
        audience: { type: "staff", staffIds: [staff._id] },
      }),
      csrfToken
    );
    expect(createRes.status).toBe(201);

    const getRes = await agent.get(`/api/notifications/${createRes.body.notification._id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.deliverySummary).toEqual({ sent: 1 });
    expect(getRes.body.recipients.length).toBe(1);
  });

  test("retry-failed increments attempts and stops once maxAttempts is reached", async () => {
    const { agent, csrfToken } = await createAdminSession(app);
    const guardian = await Guardian.create({
      fullName: "Always-Fails Guardian",
      primaryPhone: "03005550000",
      email: "always-fails@example.com",
    });

    const createRes = await withCsrf(
      agent.post("/api/notifications").send({
        title: "Will always fail",
        body: "No SMTP configured in the test env, so this fails cleanly every time",
        channels: ["email"],
        audience: { type: "all_guardians" },
      }),
      csrfToken
    );
    expect(createRes.status).toBe(201);

    const row = async () =>
      NotificationRecipient.findOne({ notification: createRes.body.notification._id, recipientId: guardian._id });

    expect((await row()).attempts).toBe(1); // the inline send-on-create attempt
    expect((await row()).status).toBe("failed");

    const retry1 = await withCsrf(agent.post("/api/notifications/retry-failed"), csrfToken);
    expect(retry1.status).toBe(200);
    expect(retry1.body.retriedCount).toBeGreaterThanOrEqual(1);
    expect((await row()).attempts).toBe(2);

    const retry2 = await withCsrf(agent.post("/api/notifications/retry-failed"), csrfToken);
    expect((await row()).attempts).toBe(3);
    void retry2;

    // Now at attempts=3, the default maxAttempts ceiling — a further
    // retry pass must leave this row untouched.
    const retry3 = await withCsrf(agent.post("/api/notifications/retry-failed"), csrfToken);
    expect(retry3.status).toBe(200);
    expect((await row()).attempts).toBe(3); // unchanged — not retried again
  });

  test("a staff (non-admin) user gets 403 creating or listing notifications, but can still hit /mine", async () => {
    const { agent, csrfToken } = await createTeacherSession(app);

    const createRes = await withCsrf(
      agent.post("/api/notifications").send({ title: "x", body: "y", audience: { type: "all_staff" } }),
      csrfToken
    );
    expect(createRes.status).toBe(403);

    const listRes = await agent.get("/api/notifications");
    expect(listRes.status).toBe(403);

    const mineRes = await agent.get("/api/notifications/mine");
    expect(mineRes.status).toBe(200);
    expect(Array.isArray(mineRes.body.items)).toBe(true);
  });

  test("/mine only returns the logged-in staff member's own in-app notifications", async () => {
    const { agent: adminAgent, csrfToken } = await createAdminSession(app);
    const { agent: teacherAgent, staff: teacherA } = await createTeacherSession(app, { fullName: "Teacher A" });
    const { staff: teacherB } = await createTeacherSession(app, { fullName: "Teacher B" });

    await withCsrf(
      adminAgent.post("/api/notifications").send({
        title: "For Teacher A only",
        body: "body",
        channels: ["in_app"],
        audience: { type: "staff", staffIds: [teacherA._id] },
      }),
      csrfToken
    );
    await withCsrf(
      adminAgent.post("/api/notifications").send({
        title: "For Teacher B only",
        body: "body",
        channels: ["in_app"],
        audience: { type: "staff", staffIds: [teacherB._id] },
      }),
      csrfToken
    );

    const mineRes = await teacherAgent.get("/api/notifications/mine");
    expect(mineRes.status).toBe(200);
    expect(mineRes.body.items.length).toBe(1);
    expect(mineRes.body.items[0].notification.title).toBe("For Teacher A only");
  });
});
