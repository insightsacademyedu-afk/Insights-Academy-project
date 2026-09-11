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
import { Field, TextInput, Select } from "../components/FormFields";
import { subjectsApi } from "../api/academicSetup";
import { useResourceList } from "../lib/useResourceList";
import { useToast } from "../context/ToastContext";

const EMPTY_FORM = { name: "", code: "", maxMarks: 100, passingMarks: 40, status: "active" };

export default function Subjects() {
  const list = useResourceList(subjectsApi);
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
    setForm({
      name: row.name,
      code: row.code,
      maxMarks: row.maxMarks,
      passingMarks: row.passingMarks,
      status: row.status,
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    const payload = { ...form, maxMarks: Number(form.maxMarks), passingMarks: Number(form.passingMarks) };
    try {
      if (editing) {
        await subjectsApi.update(editing._id, payload);
        toast.success("Subject updated");
      } else {
        await subjectsApi.create(payload);
        toast.success("Subject created");
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
      await subjectsApi.remove(deleteTarget._id, credentials);
      toast.success("Subject archived");
      setDeleteTarget(null);
      list.refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const columns = [
    { key: "name", header: "Subject", render: (row) => <span className="font-medium text-ink-900">{row.name}</span> },
    { key: "code", header: "Code", render: (row) => <span className="font-tabular text-ink-700">{row.code}</span> },
    {
      key: "marks",
      header: "Passing / Max",
      render: (row) => (
        <span className="font-tabular text-ink-700">
          {row.passingMarks} / {row.maxMarks}
        </span>
      ),
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
    <AppLayout title="Subjects">
      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search subjects…"
        status={list.status}
        onStatusChange={list.setStatus}
        onCreate={openCreate}
        createLabel="New subject"
      />

      {list.error && (
        <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-4 py-3 text-sm text-brick-600">
          Couldn't load subjects: {list.error.message}
        </div>
      )}

      <DataTable columns={columns} rows={list.items} loading={list.loading} emptyMessage="No subjects yet." />
      <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit subject" : "New subject"}>
        <form onSubmit={handleSubmit}>
          {formError && (
            <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
              {formError}
            </div>
          )}
          <Field label="Name" required>
            <TextInput
              required
              placeholder="Mathematics"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Code" required>
            <TextInput
              required
              placeholder="MATH101"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max marks" required>
              <TextInput
                type="number"
                min={1}
                required
                value={form.maxMarks}
                onChange={(e) => setForm({ ...form, maxMarks: e.target.value })}
              />
            </Field>
            <Field label="Passing marks" required>
              <TextInput
                type="number"
                min={0}
                required
                value={form.passingMarks}
                onChange={(e) => setForm({ ...form, passingMarks: e.target.value })}
              />
            </Field>
          </div>
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
              {saving ? "Saving…" : editing ? "Save changes" : "Create subject"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        busy={deleting}
        title="Archive subject"
        message={`Archive "${deleteTarget?.name}"? Related assignments and tests will be hidden with it.`}
      />
    </AppLayout>
  );
}
