import { createHash } from "node:crypto";
import { captureDatabase, decodeBackup, encodeBackup, restoreDatabase, saveBackup, backupFileName } from "../services/localBackup.js";

export async function createBackup(_req, res, next) {
  try {
    const payload = await captureDatabase();
    const buffer = await encodeBackup(payload);
    const fileName = backupFileName(payload.database, payload.createdAt);
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    try {
      await saveBackup(buffer, payload.database, payload.createdAt);
    } catch (error) {
      console.warn(`[backup] server-side copy was not saved: ${error.message}`);
    }
    res.set({ "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${fileName}"`, "X-Backup-Sha256": sha256, "Cache-Control": "no-store" });
    res.send(buffer);
  } catch (error) { next(error); }
}

export async function inspectBackup(req, res, next) {
  try {
    const payload = await decodeBackup(req.body);
    const records = Object.values(payload.collections).reduce((sum, documents) => sum + documents.length, 0);
    res.json({ database: payload.database, createdAt: payload.createdAt, collections: Object.keys(payload.collections).length, records });
  } catch (error) { next(error); }
}

export async function restoreBackup(req, res, next) {
  try {
    if (req.get("x-restore-confirmation") !== "RESTORE") return res.status(400).json({ message: "Restore confirmation is missing" });
    const result = await restoreDatabase(req.body);
    res.json({ message: "Database restored successfully. Sign in again if needed.", restoredFrom: result.incoming.createdAt, safetyBackup: result.safety.fileName });
  } catch (error) { next(error); }
}
