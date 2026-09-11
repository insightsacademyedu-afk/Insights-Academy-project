import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import AppLayout from "../components/AppLayout";
import DataTable from "../components/DataTable";
import Pagination from "../components/Pagination";
import ListToolbar from "../components/ListToolbar";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Button from "../components/Button";
import { Field, TextInput, TextArea, Select } from "../components/FormFields";
import { designationsApi } from "../api/academicSetup";
import { useResourceList } from "../lib/useResourceList";
import { useToast } from "../context/ToastContext";

const EMPTY_FORM = { title: "", description: "", status: "active" };

export default function Designations() {
  const list = useResourceList(designationsApi);
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
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
    setForm({ title: row.title, description: row.description || "", status: row.status });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await designationsApi.update(editing._id, form);
        toast.success("Designation updated");
      } else {
        await designationsApi.create(form);
        toast.success("Designation created");
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
      await designationsApi.remove(deleteTarget._id, credentials);
      toast.success("Designation archived");
      setDeleteTarget(null);
      list.refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const columns = [
    { key: "title", header: "Title", render: (row) => <span className="font-medium text-ink-900">{row.title}</span> },
    {
      key: "description",
      header: "Description",
      render: (row) => <span className="text-ink-600">{row.description || "—"}</span>,
    },
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
    <AppLayout title="Designations">
      <p className="text-sm text-ink-500 mb-4 max-w-2xl">
        Descriptive job titles for staff records only — designation never grants access. Class/section access
        comes from teacher assignments.
      </p>

      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search designations…"
        status={list.status}
        onStatusChange={list.setStatus}
        onCreate={openCreate}
        createLabel="New designation"
      />

      {list.error && (
        <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-4 py-3 text-sm text-brick-600">
          Couldn't load designations: {list.error.message}
        </div>
      )}

      <DataTable columns={columns} rows={list.items} loading={list.loading} emptyMessage="No designations yet." />
      <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit designation" : "New designation"}>
        <form onSubmit={handleSubmit}>
          {formError && (
            <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
              {formError}
            </div>
          )}
          <Field label="Title" required>
            <TextInput
              required
              placeholder="Mathematics Teacher"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <TextArea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>

          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create designation"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        busy={deleting}
        title="Archive designation"
        message={`Archive "${deleteTarget?.title}"? Staff history remains linked and the designation can be restored.`}
      />
    </AppLayout>
  );
}
