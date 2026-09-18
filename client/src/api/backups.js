import api from "./client";

export async function createBackup() {
  const response = await api.post("/backups/create", null, { responseType: "blob" });
  const disposition = response.headers["content-disposition"] || "";
  const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || `academy-${new Date().toISOString().slice(0, 10)}.academy-backup`;
  return { blob: response.data, fileName };
}

export const inspectBackup = (file) => api.post("/backups/inspect", file, {
  headers: { "Content-Type": "application/octet-stream" },
}).then((response) => response.data);

export const restoreBackup = (file) => api.post("/backups/restore", file, {
  headers: { "Content-Type": "application/octet-stream", "x-restore-confirmation": "RESTORE" },
}).then((response) => response.data);
