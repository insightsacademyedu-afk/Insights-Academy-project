import { useEffect, useState } from "react";
import { Pencil, Trash2, Plus, LayoutGrid } from "lucide-react";
import AppLayout from "../components/AppLayout";
import Panel from "../components/Panel";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";
import { Field, TextInput, Select } from "../components/FormFields";
import { classesApi, sectionsApi, academicSessionsApi } from "../api/academicSetup";
import { useResourceList } from "../lib/useResourceList";
import { useToast } from "../context/ToastContext";

export default function Classes() {
  const toast = useToast();
  const [sessions, setSessions] = useState([]);
  const [sessionFilter, setSessionFilter] = useState("");
  const [selectedClass, setSelectedClass] = useState(null);

  useEffect(() => {
    academicSessionsApi
      .list({ limit: 100, sortBy: "startDate", sortDir: "desc" })
      .then((res) => {
        setSessions(res.items);
        const current = res.items.find((s) => s.isCurrent);
        if (current) setSessionFilter(current._id);
      })
      .catch(() => {});
  }, []);

  const classList = useResourceList(classesApi, sessionFilter ? { academicSession: sessionFilter } : {});

  // Keep the selected class in sync with the list (e.g. after an edit).
  useEffect(() => {
    if (selectedClass) {
      const fresh = classList.items.find((c) => c._id === selectedClass._id);
      if (fresh && fresh !== selectedClass) setSelectedClass(fresh);
      if (!fresh && !classList.loading) setSelectedClass(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classList.items]);

  return (
    <AppLayout title="Classes & Sections">
      {sessions.length === 0 && !classList.loading && classList.items.length === 0 && (
        <div className="mb-4 rounded-md border border-dashed border-ink-300 bg-paper-50 px-4 py-3 text-sm text-ink-500">
          Create an academic session first — classes belong to a session.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-2">
          <ClassPanel
            sessions={sessions}
            sessionFilter={sessionFilter}
            onSessionFilterChange={setSessionFilter}
            list={classList}
            selected={selectedClass}
            onSelect={setSelectedClass}
            toast={toast}
          />
        </div>
        <div className="lg:col-span-3">
          {selectedClass ? (
            <SectionPanel key={selectedClass._id} klass={selectedClass} toast={toast} />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-ink-300 bg-paper-50 py-20 text-center">
              <LayoutGrid size={20} className="text-ink-400 mb-2" strokeWidth={1.75} />
              <p className="text-sm text-ink-500">Select a class to manage its sections</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function ClassPanel({ sessions, sessionFilter, onSessionFilterChange, list, selected, onSelect, toast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", academicSession: "", status: "active" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", academicSession: sessionFilter || sessions[0]?._id || "", status: "active" });
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(row, e) {
    e.stopPropagation();
    setEditing(row);
    setForm({ name: row.name, academicSession: row.academicSession?._id || row.academicSession, status: row.status });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await classesApi.update(editing._id, form);
        toast.success("Class updated");
      } else {
        await classesApi.create(form);
        toast.success("Class created");
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
      await classesApi.remove(deleteTarget._id, credentials);
      toast.success("Class archived");
      setDeleteTarget(null);
      if (selected?._id === deleteTarget._id) onSelect(null);
      list.refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Panel
      title="Classes"
      action={
        <Button onClick={openCreate} className="!py-1.5 !px-2.5 !text-xs">
          <Plus size={13} /> New
        </Button>
      }
    >
      <select
        value={sessionFilter}
        onChange={(e) => onSessionFilterChange(e.target.value)}
        className="w-full mb-3 rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-700"
      >
        <option value="">All sessions</option>
        {sessions.map((s) => (
          <option key={s._id} value={s._id}>
            {s.name}
            {s.isCurrent ? " (current)" : ""}
          </option>
        ))}
      </select>

      {list.error && (
        <div className="mb-3 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-xs text-brick-600">
          {list.error.message}
        </div>
      )}

      <div className="space-y-1 max-h-[60vh] overflow-y-auto -mx-1 px-1">
        {list.loading &&
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-11 rounded-md bg-ink-100 animate-pulse" />)}

        {!list.loading && list.items.length === 0 && (
          <div className="py-8 text-center text-sm text-ink-500">No classes for this session yet.</div>
        )}

        {!list.loading &&
          list.items.map((row) => (
            <button
              key={row._id}
              onClick={() => onSelect(row)}
              className={`w-full flex items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                selected?._id === row._id ? "bg-ink-900 text-paper-50" : "hover:bg-paper-200 text-ink-800"
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="truncate font-medium">{row.name}</span>
                {row.status === "inactive" && (
                  <span className={`shrink-0 ${selected?._id === row._id ? "opacity-70" : ""}`}>
                    <StatusBadge status={row.status} />
                  </span>
                )}
              </span>
              <span className="flex items-center gap-0.5 shrink-0">
                <span
                  onClick={(e) => openEdit(row, e)}
                  className={`p-1 rounded ${selected?._id === row._id ? "hover:bg-ink-800" : "hover:bg-ink-100"}`}
                >
                  <Pencil size={12} />
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(row);
                  }}
                  title={`Archive ${row.name}`}
                  className={`p-1 rounded ${selected?._id === row._id ? "hover:bg-ink-800" : "hover:bg-brick-100"}`}
                >
                  <Trash2 size={12} />
                </span>
              </span>
            </button>
          ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit class" : "New class"}>
        <form onSubmit={handleSubmit}>
          {formError && (
            <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
              {formError}
            </div>
          )}
          <Field label="Name" required>
            <TextInput
              required
              placeholder="Grade 5"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Academic session" required>
            <Select
              required
              value={form.academicSession}
              onChange={(e) => setForm({ ...form, academicSession: e.target.value })}
            >
              <option value="" disabled>
                Select a session
              </option>
              {sessions.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </Select>
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
              {saving ? "Saving…" : editing ? "Save changes" : "Create class"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        busy={deleting}
        title="Archive class"
        message={`Archive "${deleteTarget?.name}"? Its sections, assignments, tests, and results will be hidden from active screens and can be restored from Archive History.`}
      />
    </Panel>
  );
}

function SectionPanel({ klass, toast }) {
  const list = useResourceList(sectionsApi, { class: klass._id });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", status: "active" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", status: "active" });
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({ name: row.name, status: row.status });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await sectionsApi.update(editing._id, form);
        toast.success("Section updated");
      } else {
        await sectionsApi.create({ ...form, class: klass._id });
        toast.success("Section created");
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
      await sectionsApi.remove(deleteTarget._id, credentials);
      toast.success("Section archived");
      setDeleteTarget(null);
      list.refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Panel
      title={`Sections — ${klass.name}`}
      action={
        <Button onClick={openCreate} className="!py-1.5 !px-2.5 !text-xs">
          <Plus size={13} /> New section
        </Button>
      }
    >
      {list.error && (
        <div className="mb-3 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-xs text-brick-600">
          {list.error.message}
        </div>
      )}

      {list.loading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-11 rounded-md bg-ink-100 animate-pulse" />
          ))}
        </div>
      )}

      {!list.loading && list.items.length === 0 && (
        <div className="rounded-md border border-dashed border-ink-300 py-8 text-center text-sm text-ink-500">
          No sections in this class yet.
        </div>
      )}

      {!list.loading && list.items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {list.items.map((row) => (
            <div
              key={row._id}
              className="flex items-center justify-between rounded-md border border-ink-200 px-3.5 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink-900 text-sm">Section {row.name}</span>
                <StatusBadge status={row.status} />
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(row)} className="p-1 text-ink-500 hover:text-ink-900" aria-label="Edit">
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => setDeleteTarget(row)}
                  className="p-1 text-ink-500 hover:text-brick-600"
                  aria-label="Archive"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit section" : "New section"} width="max-w-sm">
        <form onSubmit={handleSubmit}>
          {formError && (
            <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
              {formError}
            </div>
          )}
          <Field label="Name" required>
            <TextInput
              required
              placeholder="A"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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
              {saving ? "Saving…" : editing ? "Save changes" : "Create section"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        busy={deleting}
        title="Archive section"
        message={`Archive section "${deleteTarget?.name}"? Its assignments, tests, and results will be hidden and can be restored from Archive History.`}
      />
    </Panel>
  );
}
