import { useState } from "react";
import { Pencil, Trash2, Star } from "lucide-react";
import AppLayout from "../components/AppLayout";
import DataTable from "../components/DataTable";
import Pagination from "../components/Pagination";
import ListToolbar from "../components/ListToolbar";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Button from "../components/Button";
import { Field, TextInput, Select } from "../components/FormFields";
import { academicSessionsApi } from "../api/academicSetup";
import { useResourceList } from "../lib/useResourceList";
import { useToast } from "../context/ToastContext";
import { formatDate, toDateInputValue } from "../lib/format";

const EMPTY_FORM = { name: "", startDate: "", endDate: "", isCurrent: false, status: "active" };

export default function AcademicSessions() {
  const list = useResourceList(academicSessionsApi);
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = create
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      name: row.name,
      startDate: toDateInputValue(row.startDate),
      endDate: toDateInputValue(row.endDate),
      isCurrent: row.isCurrent,
      status: row.status,
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await academicSessionsApi.update(editing._id, form);
        toast.success("Session updated");
      } else {
        await academicSessionsApi.create(form);
        toast.success("Session created");
      }
      setModalOpen(false);
      list.refetch();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(credentials) {
    setDeleting(true);
    try {
      await academicSessionsApi.remove(deleteTarget._id, credentials);
      toast.success("Session archived");
      setDeleteTarget(null);
      list.refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const columns = [
    {
      key: "name",
      header: "Session",
      render: (row) => (
        <span className="flex items-center gap-1.5 font-medium text-ink-900">
          {row.isCurrent && <Star size={13} className="text-brass-500 fill-brass-500" />}
          {row.name}
        </span>
      ),
    },
    { key: "startDate", header: "Start", render: (row) => formatDate(row.startDate) },
    { key: "endDate", header: "End", render: (row) => formatDate(row.endDate) },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "actions",
      header: "",
      headClassName: "w-20",
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => openEdit(row)} className="p-1.5 text-ink-500 hover:text-ink-900" aria-label="Edit">
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="p-1.5 text-ink-500 hover:text-brick-600"
            aria-label="Archive"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AppLayout title="Academic Sessions">
      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search sessions…"
        status={list.status}
        onStatusChange={list.setStatus}
        statusOptions={["active", "archived"]}
        onCreate={openCreate}
        createLabel="New session"
      />

      {list.error && (
        <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-4 py-3 text-sm text-brick-600">
          Couldn't load sessions: {list.error.message}
        </div>
      )}

      <DataTable columns={columns} rows={list.items} loading={list.loading} emptyMessage="No academic sessions yet." />
      <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit session" : "New session"}>
        <form onSubmit={handleSubmit}>
          {formError && (
            <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
              {formError}
            </div>
          )}
          <Field label="Name" required>
            <TextInput
              required
              placeholder="2026-2027"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" required>
              <TextInput
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>
            <Field label="End date" required>
              <TextInput
                type="date"
                required
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2 mb-5 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={form.isCurrent}
              onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })}
              className="rounded border-ink-300"
            />
            Mark as the current session
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create session"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        busy={deleting}
        title="Archive session"
        message={`Archive "${deleteTarget?.name}"? Its classes and related academic records will be hidden together.`}
      />
    </AppLayout>
  );
}
