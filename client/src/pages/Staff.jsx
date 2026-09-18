import { formatCurrency } from "../lib/format";
import { useEffect, useState } from "react";
import { Pencil, Trash2, KeyRound, RefreshCw, ShieldOff, Plus } from "lucide-react";
import AppLayout from "../components/AppLayout";
import DataTable from "../components/DataTable";
import Pagination from "../components/Pagination";
import ListToolbar from "../components/ListToolbar";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Button from "../components/Button";
import { Field, TextInput, Select } from "../components/FormFields";
import { staffApi } from "../api/staff";
import { teacherAssignmentsApi } from "../api/teacherAssignments";
import { designationsApi, academicSessionsApi, classesApi, sectionsApi, subjectsApi } from "../api/academicSetup";
import { useResourceList } from "../lib/useResourceList";
import { useToast } from "../context/ToastContext";
import { toDateInputValue } from "../lib/format";

export default function Staff() {
  const [tab, setTab] = useState("staff"); // staff | assignments

  return (
    <AppLayout title="Staff & Teachers">
      <div className="mb-5 inline-flex rounded-md border border-ink-200 bg-paper-50 p-0.5">
        {[
          { key: "staff", label: "Staff directory" },
          { key: "assignments", label: "Teacher assignments" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded px-3.5 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-ink-900 text-paper-50" : "text-ink-600 hover:text-ink-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "staff" ? <StaffDirectory /> : <TeacherAssignments />}
    </AppLayout>
  );
}

const EMPTY_STAFF_FORM = {
  fullName: "",
  designation: "",
  phone: "",
  email: "",
  joiningDate: "",
  basicSalary: "",
  salaryType: "monthly",
  status: "active",
};

function StaffDirectory() {
  const list = useResourceList(staffApi);
  const toast = useToast();
  const [designations, setDesignations] = useState([]);

  useEffect(() => {
    designationsApi
      .list({ limit: 100, status: "active" })
      .then((res) => setDesignations(res.items))
      .catch(() => {});
  }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_STAFF_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [createLoginTarget, setCreateLoginTarget] = useState(null);
  const [resetPasswordTarget, setResetPasswordTarget] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_STAFF_FORM);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      fullName: row.fullName,
      designation: row.designation?._id || row.designation || "",
      phone: row.phone || "",
      email: row.email || "",
      joiningDate: toDateInputValue(row.joiningDate),
      basicSalary: row.basicSalary ? String(row.basicSalary) : "",
      salaryType: row.salaryType || "monthly",
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
      const payload = {
        ...form,
        designation: form.designation || null,
        basicSalary: form.basicSalary === "" ? 0 : Number(form.basicSalary),
      };
      if (editing) {
        await staffApi.update(editing._id, payload);
        toast.success("Staff profile updated");
      } else {
        await staffApi.create(payload);
        toast.success("Staff profile created");
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
      await staffApi.remove(deleteTarget._id, credentials);
      toast.success("Staff profile archived");
      setDeleteTarget(null);
      list.refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleRevoke() {
    setRevoking(true);
    try {
      await staffApi.revokeLogin(revokeTarget._id);
      toast.success("Login access revoked");
      setRevokeTarget(null);
      list.refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRevoking(false);
    }
  }

  const columns = [
    {
      key: "fullName",
      header: "Staff",
      render: (row) => (
        <div>
          <div className="font-medium text-ink-900">{row.fullName}</div>
          <div className="text-xs text-ink-500">{row.email || "No email on file"}</div>
        </div>
      ),
    },
    {
      key: "designation",
      header: "Designation",
      render: (row) => row.designation?.title || <span className="text-ink-400">—</span>,
    },
    { key: "phone", header: "Phone", render: (row) => row.phone || "—" },
    { key: "salary", header: "Salary", render: (row) => `${formatCurrency(row.basicSalary)} / ${row.salaryType}` },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "login",
      header: "Login",
      render: (row) =>
        row.user ? (
          <span className="inline-block rounded-full bg-moss-100 px-2.5 py-0.5 text-[11px] font-medium text-moss-600">
            Active
          </span>
        ) : (
          <span className="inline-block rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-600">
            None
          </span>
        ),
    },
    {
      key: "actions",
      header: "",
      headClassName: "w-36",
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          {!row.user ? (
            <button
              onClick={() => setCreateLoginTarget(row)}
              className="p-1.5 text-ink-500 hover:text-ink-900"
              aria-label="Create login"
              title="Create login"
            >
              <KeyRound size={14} />
            </button>
          ) : (
            <>
              <button
                onClick={() => setResetPasswordTarget(row)}
                className="p-1.5 text-ink-500 hover:text-ink-900"
                aria-label="Reset password"
                title="Reset password"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={() => setRevokeTarget(row)}
                className="p-1.5 text-ink-500 hover:text-brick-600"
                aria-label="Revoke login"
                title="Revoke login"
              >
                <ShieldOff size={14} />
              </button>
            </>
          )}
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
    <>
      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search name, email, phone…"
        status={list.status}
        onStatusChange={list.setStatus}
        onCreate={openCreate}
        createLabel="New staff"
      />

      {list.error && (
        <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-4 py-3 text-sm text-brick-600">
          Couldn't load staff: {list.error.message}
        </div>
      )}

      <DataTable columns={columns} rows={list.items} loading={list.loading} emptyMessage="No staff profiles yet." />
      <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit staff" : "New staff"}>
        <form onSubmit={handleSubmit}>
          {formError && (
            <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
              {formError}
            </div>
          )}
          <Field label="Full name" required>
            <TextInput
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </Field>
          <Field label="Designation">
            <Select
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
            >
              <option value="">Not set</option>
              {designations.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.title}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <TextInput
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Joining date">
              <TextInput
                type="date"
                value={form.joiningDate}
                onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Basic salary">
              <TextInput
                type="number"
                step="0.01"
                min="0"
                value={form.basicSalary}
                onChange={(e) => setForm({ ...form, basicSalary: e.target.value })}
              />
            </Field>
            <Field label="Salary type">
              <Select value={form.salaryType} onChange={(e) => setForm({ ...form, salaryType: e.target.value })}>
                <option value="monthly">Monthly</option>
                <option value="hourly">Hourly</option>
                <option value="contract">Contract</option>
              </Select>
            </Field>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create staff"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        busy={deleting}
        title="Archive staff"
        message={`Archive "${deleteTarget?.fullName}"? Their login will be disabled and assignments hidden. The profile can be restored from Archive History.`}
      />

      <CreateLoginModal
        key={createLoginTarget?._id || "create-login-closed"}
        staff={createLoginTarget}
        onClose={() => setCreateLoginTarget(null)}
        onDone={() => {
          setCreateLoginTarget(null);
          list.refetch();
        }}
      />

      <ResetPasswordModal
        key={resetPasswordTarget?._id || "reset-password-closed"}
        staff={resetPasswordTarget}
        onClose={() => setResetPasswordTarget(null)}
      />

      <ConfirmDialog
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        busy={revoking}
        title="Revoke login access"
        confirmLabel="Revoke"
        message={`Revoke login access for "${revokeTarget?.fullName}"? Any active session is invalidated immediately; their staff profile and history are kept.`}
      />
    </>
  );
}

function CreateLoginModal({ staff, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ username: "", email: staff?.email || "", password: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await staffApi.createLogin(staff._id, form);
      toast.success(`Login account created for ${staff.fullName}`);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!staff} onClose={onClose} title={`Create login — ${staff?.fullName || ""}`} width="max-w-sm">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
            {error}
          </div>
        )}
        <Field label="Username" required>
          <TextInput
            required
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </Field>
        <Field label="Email" required>
          <TextInput
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Password" required>
          <TextInput
            type="password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create login"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ staff, onClose }) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await staffApi.resetPassword(staff._id, { password });
      toast.success(`Password reset for ${staff.fullName}`);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!staff} onClose={onClose} title={`Reset password — ${staff?.fullName || ""}`} width="max-w-sm">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
            {error}
          </div>
        )}
        <Field label="New password" required>
          <TextInput
            type="password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <p className="mb-4 text-xs text-ink-500">
          This immediately invalidates their existing session — they must log in again with the new password.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Resetting…" : "Reset password"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const EMPTY_ASSIGNMENT_FORM = {
  teacher: "",
  academicSession: "",
  class: "",
  section: "",
  subject: "",
  status: "active",
};

function TeacherAssignments() {
  const toast = useToast();
  const [sessions, setSessions] = useState([]);
  const [sessionFilter, setSessionFilter] = useState("");

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

  const list = useResourceList(teacherAssignmentsApi, sessionFilter ? { academicSession: sessionFilter } : {});

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setModalOpen(true);
  }

  async function handleDelete(credentials) {
    setDeleting(true);
    try {
      await teacherAssignmentsApi.remove(deleteTarget._id, credentials);
      toast.success("Assignment archived");
      setDeleteTarget(null);
      list.refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const columns = [
    { key: "teacher", header: "Teacher", render: (row) => row.teacher?.fullName || "—" },
    {
      key: "class",
      header: "Class / Section",
      render: (row) => `${row.class?.name || "—"} / ${row.section?.name || "—"}`,
    },
    {
      key: "subject",
      header: "Subject",
      render: (row) => (row.subject ? `${row.subject.name} (${row.subject.code})` : "—"),
    },
    { key: "session", header: "Session", render: (row) => row.academicSession?.name || "—" },
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
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <select
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
          className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-700"
        >
          <option value="">All sessions</option>
          {sessions.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
              {s.isCurrent ? " (current)" : ""}
            </option>
          ))}
        </select>

        <select
          value={list.status}
          onChange={(e) => list.setStatus(e.target.value)}
          className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-700"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <div className="flex-1" />

        <Button onClick={openCreate}>
          <Plus size={15} />
          New assignment
        </Button>
      </div>

      {list.error && (
        <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-4 py-3 text-sm text-brick-600">
          Couldn't load assignments: {list.error.message}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={list.items}
        loading={list.loading}
        emptyMessage="No teacher assignments yet — this is what grants a teacher access to a class/section/subject."
      />
      <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />

      <AssignmentFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        sessions={sessions}
        defaultSession={sessionFilter}
        onSaved={() => {
          setModalOpen(false);
          list.refetch();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        busy={deleting}
          title="Archive assignment"
          message="Archive this assignment? The teacher will immediately lose access to the class, section, and subject. An admin can restore it from Archive History."
      />
    </>
  );
}

function AssignmentFormModal({ open, onClose, editing, sessions, defaultSession, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_ASSIGNMENT_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [teachers, setTeachers] = useState([]);
  const [classesForSession, setClassesForSession] = useState([]);
  const [sectionsForClass, setSectionsForClass] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Reset form + load static dropdown data whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setError("");
    if (editing) {
      setForm({
        teacher: editing.teacher?._id || editing.teacher || "",
        academicSession: editing.academicSession?._id || editing.academicSession || "",
        class: editing.class?._id || editing.class || "",
        section: editing.section?._id || editing.section || "",
        subject: editing.subject?._id || editing.subject || "",
        status: editing.status || "active",
      });
    } else {
      setForm({ ...EMPTY_ASSIGNMENT_FORM, academicSession: defaultSession || "" });
    }

    staffApi
      .list({ limit: 200, status: "active" })
      .then((res) => setTeachers(res.items))
      .catch(() => {});
    subjectsApi
      .list({ limit: 200, status: "active" })
      .then((res) => setSubjects(res.items))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // Classes depend on the chosen session.
  useEffect(() => {
    if (!form.academicSession) {
      setClassesForSession([]);
      return;
    }
    classesApi
      .list({ limit: 200, academicSession: form.academicSession, status: "active" })
      .then((res) => setClassesForSession(res.items))
      .catch(() => {});
  }, [form.academicSession]);

  // Sections depend on the chosen class.
  useEffect(() => {
    if (!form.class) {
      setSectionsForClass([]);
      return;
    }
    sectionsApi
      .list({ limit: 200, class: form.class, status: "active" })
      .then((res) => setSectionsForClass(res.items))
      .catch(() => {});
  }, [form.class]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await teacherAssignmentsApi.update(editing._id, form);
        toast.success("Assignment updated");
      } else {
        await teacherAssignmentsApi.create(form);
        toast.success("Assignment created");
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit assignment" : "New assignment"}>
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
            {error}
          </div>
        )}
        <Field label="Teacher" required>
          <Select required value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })}>
            <option value="" disabled>
              Select a teacher
            </option>
            {teachers.map((t) => (
              <option key={t._id} value={t._id}>
                {t.fullName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Academic session" required>
          <Select
            required
            value={form.academicSession}
            onChange={(e) => setForm({ ...form, academicSession: e.target.value, class: "", section: "" })}
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Class" required>
            <Select
              required
              disabled={!form.academicSession}
              value={form.class}
              onChange={(e) => setForm({ ...form, class: e.target.value, section: "" })}
            >
              <option value="" disabled>
                {form.academicSession ? "Select a class" : "Pick a session first"}
              </option>
              {classesForSession.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Section" required>
            <Select
              required
              disabled={!form.class}
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value })}
            >
              <option value="" disabled>
                {form.class ? "Select a section" : "Pick a class first"}
              </option>
              {sectionsForClass.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Subject" required>
          <Select required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
            <option value="" disabled>
              Select a subject
            </option>
            {subjects.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.code})
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
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Create assignment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
