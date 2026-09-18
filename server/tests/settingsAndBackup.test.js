import app from "../app.js";
import AcademySettings from "../models/AcademySettings.js";
import { createAdminSession, createTeacherSession, withCsrf } from "./helpers/authHelpers.js";

describe("local settings and database protection", () => {
  test("admin can edit academy and receipt details while staff can only read them", async () => {
    const admin = await createAdminSession(app);
    const teacher = await createTeacherSession(app);
    expect((await teacher.agent.get("/api/settings")).body.academyName).toBe("Academy Management");
    expect((await withCsrf(teacher.agent.put("/api/settings").send({ academyName: "No" }), teacher.csrfToken)).status).toBe(403);

    const response = await withCsrf(admin.agent.put("/api/settings").send({
      academyName: "Insight Academy",
      academyPhone: "0300-1234567",
      receiptName: "Insight Fee Office",
      receiptPhone: "0311-7654321",
      receiptFooter: "Please keep this receipt.",
    }), admin.csrfToken);
    expect(response.status).toBe(200);
    expect(response.body.receiptFooter).toBe("Please keep this receipt.");
    expect((await AcademySettings.findById("academy")).academyPhone).toBe("0300-1234567");
  });

  test("a created backup can be inspected and restores the previous database contents", async () => {
    const admin = await createAdminSession(app);
    await withCsrf(admin.agent.put("/api/settings").send({ academyName: "Before backup" }), admin.csrfToken);
    const backup = await withCsrf(admin.agent.post("/api/backups/create"), admin.csrfToken).buffer(true);
    expect(backup.status).toBe(200);
    expect(backup.headers["content-disposition"]).toContain(".academy-backup");

    const inspection = await withCsrf(admin.agent.post("/api/backups/inspect").set("Content-Type", "application/octet-stream").send(backup.body), admin.csrfToken);
    expect(inspection.status).toBe(200);
    expect(inspection.body.records).toBeGreaterThan(0);

    await AcademySettings.findByIdAndUpdate("academy", { academyName: "After backup" });
    const restored = await withCsrf(admin.agent.post("/api/backups/restore").set("Content-Type", "application/octet-stream").set("x-restore-confirmation", "RESTORE").send(backup.body), admin.csrfToken);
    expect(restored.status).toBe(200);
    expect((await AcademySettings.findById("academy")).academyName).toBe("Before backup");
  });
});
