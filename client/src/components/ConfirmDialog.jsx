import { useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import { Field, TextArea, TextInput } from "./FormFields";

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Archive", busy }) {
  const [adminPassword, setAdminPassword] = useState("");
  const [reason, setReason] = useState("");
  function confirm() {
    if (!adminPassword || reason.trim().length < 3) return;
    onConfirm({ adminPassword, reason: reason.trim() });
    setAdminPassword("");
    setReason("");
  }

  function close() {
    setAdminPassword("");
    setReason("");
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title={title} width="max-w-sm">
      <p className="text-sm text-ink-700">{message}</p>
      <p className="mt-3 text-xs text-ink-500">
        {confirmLabel === "Restore"
          ? "The record and the related records archived in the same operation will return to normal screens."
          : "The record stays in database history. Normal pages and dashboard counts hide it. Related academic setup, assignment and test records may be archived together; financial history is preserved."}
      </p>
      <div className="mt-4">
        <Field label="Reason" required>
          <TextArea required minLength={3} maxLength={500} value={reason} disabled={busy}
            onChange={(event) => setReason(event.target.value)} placeholder="Why is this record being archived?" />
        </Field>
        <Field label="Current admin password" required>
          <TextInput type="password" required maxLength={72} autoComplete="current-password"
            value={adminPassword} disabled={busy} onChange={(event) => setAdminPassword(event.target.value)} />
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={close} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={confirm} disabled={busy || !adminPassword || reason.trim().length < 3}>
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
