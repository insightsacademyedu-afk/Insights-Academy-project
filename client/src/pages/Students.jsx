import { useEffect, useState } from "react";
import { Search, Plus, Eye, Pencil, Trash2, ArrowRightLeft } from "lucide-react";
import AppLayout from "../components/AppLayout";
import DataTable from "../components/DataTable";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";
import { Field, TextInput, TextArea, Select } from "../components/FormFields";
import { studentsApi } from "../api/students";
import { academicSessionsApi, classesApi, sectionsApi } from "../api/academicSetup";
import { useResourceList } from "../lib/useResourceList";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { formatCurrency, formatDate, toDateInputValue } from "../lib/format";

// Student.status has five values (not the generic active/inactive most
// other modules use), so this page can't reuse the shared ListToolbar's
// hard-coded two-option status filter — the toolbar below is built by
// hand, same as the teacher-assignments tab on the Staff page.
const STUDENT_STATUSES = ["active", "inactive", "transferred", "graduated", "expelled"];

function emptyStudentForm() {
  return {
    admissionNumber: "",
    fullName: "",
    fatherName: "",
    gender: "male",
    dob: "",
    cnicOrBForm: "",
    address: "",
    phone: "",
    admissionDate: toDateInputValue(new Date()),
    status: "active",
    feeDetails: {
      monthlyTuition: 0,
      admissionFee: 0,
      examFee: 0,
      otherFee: 0,
      discount: 0,
      scholarship: 0,
    },
    guardian: {
      fullName: "",
      relationship: "Father",
      primaryPhone: "",
      secondaryPhone: "",
      whatsappPhone: "",
      email: "",
      address: "",
      emergencyContact: "",
    },
  };
}

const EMPTY_ENROLLMENT = { academicSession: "", class: "", section: "", rollNumber: "" };

export default function Students() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [genderFilter, setGenderFilter] = useState("");
  const list = useResourceList(studentsApi, genderFilter ? { gender: genderFilter } : {});

  const [sessions, setSessions] = useState([]);
  useEffect(() => {
    academicSessionsApi
      .list({ limit: 100, sortBy: "startDate", sortDir: "desc" })
      .then((res) => setSessions(res.items))
      .catch(() => {});
  }, []);

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [enrollTarget, setEnrollTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function openCreate() {
    setEditing(null);
    setFormModalOpen(true);
  }

  function openEdit(row) {
    setViewTarget(null);
    setEditing(row);
    setFormModalOpen(true);
  }

  function openEnroll(row) {
    setViewTarget(null);
    setEnrollTarget(row);
  }

  function openDelete(row) {
    setViewTarget(null);
    setDeleteTarget(row);
  }

  async function handleDelete(credentials) {
    setDeleting(true);
    try {
      await studentsApi.remove(deleteTarget._id, credentials);
      toast.success("Student archived");
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
      key: "student",
      header: "Student",
      render: (row) => (
        <div>
          <div className="font-medium text-ink-900">{row.fullName}</div>
          <div className="text-xs text-ink-500 font-tabular">{row.admissionNumber}</div>
        </div>
      ),
    },
    isAdmin && {
      key: "guardian",
      header: "Guardian",
      render: (row) =>
        row.guardian?.fullName ? (
          <div>
            <div className="text-ink-800">{row.guardian.fullName}</div>
            <div className="text-xs text-ink-500">{row.guardian.primaryPhone}</div>
          </div>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    { key: "gender", header: "Gender", render: (row) => <span className="capitalize">{row.gender}</span> },
    { key: "dob", header: "Date of birth", render: (row) => formatDate(row.dob) },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "actions",
      header: "",
      headClassName: isAdmin ? "w-32" : "w-12",
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={() => setViewTarget(row)}
            className="p-1.5 text-ink-500 hover:text-ink-900"
            aria-label="View"
            title="View details"
          >
            <Eye size={14} />
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => openEnroll(row)}
                className="p-1.5 text-ink-500 hover:text-ink-900"
                aria-label="Enroll or transfer"
                title="Enroll / transfer"
              >
                <ArrowRightLeft size={14} />
              </button>
              <button
                onClick={() => openEdit(row)}
                className="p-1.5 text-ink-500 hover:text-ink-900"
                aria-label="Edit"
                title="Edit"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => openDelete(row)}
                className="p-1.5 text-ink-500 hover:text-brick-600"
                aria-label="Archive"
                title="Archive"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ].filter(Boolean);

  return (
    <AppLayout title="Students">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value)}
            placeholder="Search name, admission #…"
            className="w-full rounded-md border border-ink-200 bg-white pl-9 pr-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-700/10"
          />
        </div>

        <select
          value={list.status}
          onChange={(e) => list.setStatus(e.target.value)}
          className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-700"
        >
          <option value="">All statuses</option>
          {STUDENT_STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-700"
        >
          <option value="">All genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>

        <div className="flex-1" />

        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus size={15} />
            New student
          </Button>
        )}
      </div>

      {list.error && (
        <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-4 py-3 text-sm text-brick-600">
          Couldn't load students: {list.error.message}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={list.items}
        loading={list.loading}
        emptyMessage={
          isAdmin
            ? "No students yet — create one to enroll them into a class/section."
            : "No students assigned to your classes yet."
        }
      />
      <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />

      {isAdmin && (
        <StudentFormModal
          open={formModalOpen}
          editing={editing}
          sessions={sessions}
          onClose={() => setFormModalOpen(false)}
          onSaved={() => {
            setFormModalOpen(false);
            list.refetch();
          }}
        />
      )}

      <StudentDetailModal
        student={viewTarget}
        isAdmin={isAdmin}
        onClose={() => setViewTarget(null)}
        onEdit={openEdit}
        onEnroll={openEnroll}
        onDelete={openDelete}
      />

      {isAdmin && (
        <EnrollModal
          key={enrollTarget?._id || "enroll-closed"}
          student={enrollTarget}
          sessions={sessions}
          onClose={() => setEnrollTarget(null)}
          onSaved={() => {
            setEnrollTarget(null);
            list.refetch();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        busy={deleting}
        title="Archive student"
        message={`Archive "${deleteTarget?.fullName}"? Enrollment is hidden; billing and academic history remain preserved.`}
      />
    </AppLayout>
  );
}

function SectionHeading({ children }) {
  return (
    <h4 className="mt-1 mb-3 border-t border-ink-100 pt-4 text-xs font-semibold uppercase tracking-wide text-ink-500 first:border-0 first:pt-0">
      {children}
    </h4>
  );
}

function StudentFormModal({ open, onClose, editing, sessions, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(emptyStudentForm);
  const [enrollment, setEnrollment] = useState(EMPTY_ENROLLMENT);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [classesForSession, setClassesForSession] = useState([]);
  const [sectionsForClass, setSectionsForClass] = useState([]);

  // Reset the form (and, for a new student, the enrollment sub-form) every
  // time the modal opens or the target being edited changes.
  useEffect(() => {
    if (!open) return;
    setError("");
    if (editing) {
      setForm({
        admissionNumber: editing.admissionNumber,
        fullName: editing.fullName,
        fatherName: editing.fatherName || "",
        gender: editing.gender,
        dob: toDateInputValue(editing.dob),
        cnicOrBForm: editing.cnicOrBForm || "",
        address: editing.address || "",
        phone: editing.phone || "",
        admissionDate: toDateInputValue(editing.admissionDate),
        status: editing.status,
        feeDetails: {
          monthlyTuition: 0,
          admissionFee: 0,
          examFee: 0,
          otherFee: 0,
          discount: 0,
          scholarship: 0,
          ...(editing.feeDetails || {}),
        },
        guardian: {
          fullName: editing.guardian?.fullName || "",
          relationship: editing.guardian?.relationship || "Father",
          primaryPhone: editing.guardian?.primaryPhone || "",
          secondaryPhone: editing.guardian?.secondaryPhone || "",
          whatsappPhone: editing.guardian?.whatsappPhone || "",
          email: editing.guardian?.email || "",
          address: editing.guardian?.address || "",
          emergencyContact: editing.guardian?.emergencyContact || "",
        },
      });
    } else {
      setForm(emptyStudentForm());
      setEnrollment({ ...EMPTY_ENROLLMENT, academicSession: sessions.find((s) => s.isCurrent)?._id || "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // Enrollment's class/section dropdowns only apply to new students.
  useEffect(() => {
    if (!enrollment.academicSession) {
      setClassesForSession([]);
      return;
    }
    classesApi
      .list({ limit: 200, academicSession: enrollment.academicSession, status: "active" })
      .then((res) => setClassesForSession(res.items))
      .catch(() => {});
  }, [enrollment.academicSession]);

  useEffect(() => {
    if (!enrollment.class) {
      setSectionsForClass([]);
      return;
    }
    sectionsApi
      .list({ limit: 200, class: enrollment.class, status: "active" })
      .then((res) => setSectionsForClass(res.items))
      .catch(() => {});
  }, [enrollment.class]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!editing && (!enrollment.academicSession || !enrollment.class || !enrollment.section || !enrollment.rollNumber)) {
      setError("Session, class, section and roll number are all required to enroll a new student.");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await studentsApi.update(editing._id, form);
        toast.success("Student updated");
      } else {
        await studentsApi.create({ ...form, enrollment });
        toast.success("Student created and enrolled");
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit student" : "New student"} width="max-w-2xl">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
            {error}
          </div>
        )}

        <SectionHeading>Student</SectionHeading>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name" required>
            <TextInput required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </Field>
          <Field label="Admission number" required>
            <TextInput
              required
              value={form.admissionNumber}
              onChange={(e) => setForm({ ...form, admissionNumber: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Father's name">
            <TextInput value={form.fatherName} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} />
          </Field>
          <Field label="Gender" required>
            <Select required value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date of birth" required>
            <TextInput required type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
          </Field>
          <Field label="Admission date">
            <TextInput
              type="date"
              value={form.admissionDate}
              onChange={(e) => setForm({ ...form, admissionDate: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="CNIC / B-Form">
            <TextInput value={form.cnicOrBForm} onChange={(e) => setForm({ ...form, cnicOrBForm: e.target.value })} />
          </Field>
          <Field label="Phone">
            <TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
        </div>
        <Field label="Address">
          <TextArea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        {editing && (
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STUDENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <SectionHeading>Guardian</SectionHeading>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Guardian name" required>
            <TextInput
              required
              value={form.guardian.fullName}
              onChange={(e) => setForm({ ...form, guardian: { ...form.guardian, fullName: e.target.value } })}
            />
          </Field>
          <Field label="Relationship">
            <Select
              value={form.guardian.relationship}
              onChange={(e) => setForm({ ...form, guardian: { ...form.guardian, relationship: e.target.value } })}
            >
              <option value="Father">Father</option>
              <option value="Mother">Mother</option>
              <option value="Guardian">Guardian</option>
              <option value="Other">Other</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Primary phone" required>
            <TextInput
              required
              value={form.guardian.primaryPhone}
              onChange={(e) => setForm({ ...form, guardian: { ...form.guardian, primaryPhone: e.target.value } })}
            />
          </Field>
          <Field label="Secondary phone">
            <TextInput
              value={form.guardian.secondaryPhone}
              onChange={(e) => setForm({ ...form, guardian: { ...form.guardian, secondaryPhone: e.target.value } })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="WhatsApp phone">
            <TextInput
              value={form.guardian.whatsappPhone}
              onChange={(e) => setForm({ ...form, guardian: { ...form.guardian, whatsappPhone: e.target.value } })}
            />
          </Field>
          <Field label="Email">
            <TextInput
              type="email"
              value={form.guardian.email}
              onChange={(e) => setForm({ ...form, guardian: { ...form.guardian, email: e.target.value } })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Guardian address">
            <TextInput
              value={form.guardian.address}
              onChange={(e) => setForm({ ...form, guardian: { ...form.guardian, address: e.target.value } })}
            />
          </Field>
          <Field label="Emergency contact">
            <TextInput
              value={form.guardian.emergencyContact}
              onChange={(e) => setForm({ ...form, guardian: { ...form.guardian, emergencyContact: e.target.value } })}
            />
          </Field>
        </div>

        <SectionHeading>Fee structure</SectionHeading>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Monthly tuition">
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={form.feeDetails.monthlyTuition}
              onChange={(e) =>
                setForm({ ...form, feeDetails: { ...form.feeDetails, monthlyTuition: Number(e.target.value) } })
              }
            />
          </Field>
          <Field label="Admission fee">
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={form.feeDetails.admissionFee}
              onChange={(e) =>
                setForm({ ...form, feeDetails: { ...form.feeDetails, admissionFee: Number(e.target.value) } })
              }
            />
          </Field>
          <Field label="Exam fee">
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={form.feeDetails.examFee}
              onChange={(e) => setForm({ ...form, feeDetails: { ...form.feeDetails, examFee: Number(e.target.value) } })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Other fee">
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={form.feeDetails.otherFee}
              onChange={(e) => setForm({ ...form, feeDetails: { ...form.feeDetails, otherFee: Number(e.target.value) } })}
            />
          </Field>
          <Field label="Discount">
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={form.feeDetails.discount}
              onChange={(e) => setForm({ ...form, feeDetails: { ...form.feeDetails, discount: Number(e.target.value) } })}
            />
          </Field>
          <Field label="Scholarship">
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={form.feeDetails.scholarship}
              onChange={(e) =>
                setForm({ ...form, feeDetails: { ...form.feeDetails, scholarship: Number(e.target.value) } })
              }
            />
          </Field>
        </div>

        {!editing && (
          <>
            <SectionHeading>Enrollment</SectionHeading>
            <p className="-mt-2 mb-3 text-xs text-ink-500">
              Every new student is placed into a class/section for a session at creation — this becomes their first
              class placement record.
            </p>
            <Field label="Academic session" required>
              <Select
                required
                value={enrollment.academicSession}
                onChange={(e) => setEnrollment({ ...enrollment, academicSession: e.target.value, class: "", section: "" })}
              >
                <option value="" disabled>
                  Select a session
                </option>
                {sessions.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                    {s.isCurrent ? " (current)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Class" required>
                <Select
                  required
                  disabled={!enrollment.academicSession}
                  value={enrollment.class}
                  onChange={(e) => setEnrollment({ ...enrollment, class: e.target.value, section: "" })}
                >
                  <option value="" disabled>
                    {enrollment.academicSession ? "Select a class" : "Pick a session first"}
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
                  disabled={!enrollment.class}
                  value={enrollment.section}
                  onChange={(e) => setEnrollment({ ...enrollment, section: e.target.value })}
                >
                  <option value="" disabled>
                    {enrollment.class ? "Select a section" : "Pick a class first"}
                  </option>
                  {sectionsForClass.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Roll number" required>
              <TextInput
                required
                value={enrollment.rollNumber}
                onChange={(e) => setEnrollment({ ...enrollment, rollNumber: e.target.value })}
              />
            </Field>
          </>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Create & enroll"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EnrollModal({ student, sessions, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ ...EMPTY_ENROLLMENT, academicSession: sessions.find((s) => s.isCurrent)?._id || "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [classesForSession, setClassesForSession] = useState([]);
  const [sectionsForClass, setSectionsForClass] = useState([]);

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
      await studentsApi.enroll(student._id, form);
      toast.success(`${student.fullName} enrolled for the selected session`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!student} onClose={onClose} title={`Enroll / transfer — ${student?.fullName || ""}`} width="max-w-sm">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
            {error}
          </div>
        )}
        <p className="mb-4 text-xs text-ink-500">
          This creates a new class placement for a session — past assignments stay on record as history rather than
          being overwritten.
        </p>
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
                {s.isCurrent ? " (current)" : ""}
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
        <Field label="Roll number" required>
          <TextInput required value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} />
        </Field>

        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Enroll"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DetailSection({ title, children }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</h4>
      <div className="space-y-1.5 rounded-md border border-ink-100 bg-paper-100/60 px-3.5 py-3">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-900 text-right">{value || "—"}</span>
    </div>
  );
}

function StudentDetailModal({ student, isAdmin, onClose, onEdit, onEnroll, onDelete }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!student) return;
    setLoading(true);
    setError(null);
    setDetail(null);
    studentsApi
      .getOne(student._id)
      .then((res) => setDetail(res))
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [student]);

  if (!student) return null;

  const s = detail?.student;
  const assignment = detail?.currentAssignment;

  return (
    <Modal open={!!student} onClose={onClose} title={student.fullName} width="max-w-lg">
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 rounded-md bg-ink-100 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
          Couldn't load details: {error.message}
        </div>
      )}

      {!loading && !error && s && (
        <div className="space-y-5">
          <DetailSection title="Student">
            <DetailRow label="Admission #" value={s.admissionNumber} />
            <DetailRow label="Father's name" value={s.fatherName} />
            <DetailRow label="Gender" value={<span className="capitalize">{s.gender}</span>} />
            <DetailRow label="Date of birth" value={formatDate(s.dob)} />
            {isAdmin && <DetailRow label="CNIC / B-Form" value={s.cnicOrBForm} />}
            <DetailRow label="Phone" value={s.phone} />
            <DetailRow label="Address" value={s.address} />
            <DetailRow label="Admission date" value={formatDate(s.admissionDate)} />
            <DetailRow label="Status" value={<StatusBadge status={s.status} />} />
          </DetailSection>

          <DetailSection title="Guardian">
            <DetailRow label="Name" value={s.guardian?.fullName} />
            <DetailRow label="Relationship" value={s.guardian?.relationship} />
            <DetailRow label="Primary phone" value={s.guardian?.primaryPhone} />
            {s.guardian?.secondaryPhone && <DetailRow label="Secondary phone" value={s.guardian.secondaryPhone} />}
            {s.guardian?.whatsappPhone && <DetailRow label="WhatsApp" value={s.guardian.whatsappPhone} />}
            {s.guardian?.email && <DetailRow label="Email" value={s.guardian.email} />}
            {s.guardian?.address && <DetailRow label="Address" value={s.guardian.address} />}
            {s.guardian?.emergencyContact && <DetailRow label="Emergency contact" value={s.guardian.emergencyContact} />}
          </DetailSection>

          {isAdmin && s.feeDetails && (
            <DetailSection title="Fee structure">
              <DetailRow label="Monthly tuition" value={formatCurrency(s.feeDetails.monthlyTuition)} />
              <DetailRow label="Admission fee" value={formatCurrency(s.feeDetails.admissionFee)} />
              <DetailRow label="Exam fee" value={formatCurrency(s.feeDetails.examFee)} />
              <DetailRow label="Other fee" value={formatCurrency(s.feeDetails.otherFee)} />
              <DetailRow label="Discount" value={formatCurrency(s.feeDetails.discount)} />
              <DetailRow label="Scholarship" value={formatCurrency(s.feeDetails.scholarship)} />
              <div className="mt-1 flex items-center justify-between gap-4 border-t border-ink-200 pt-1.5 text-sm">
                <span className="font-medium text-ink-700">Total payable</span>
                <span className="font-tabular font-semibold text-ink-950">{formatCurrency(s.totalPayable)}</span>
              </div>
            </DetailSection>
          )}

          <DetailSection title="Current placement">
            {assignment ? (
              <>
                <DetailRow label="Session" value={assignment.academicSession?.name} />
                <DetailRow
                  label="Class / Section"
                  value={`${assignment.class?.name || "—"} / ${assignment.section?.name || "—"}`}
                />
                <DetailRow label="Roll number" value={assignment.rollNumber} />
                <DetailRow label="Status" value={<StatusBadge status={assignment.status} />} />
              </>
            ) : (
              <p className="text-sm text-ink-500">Not enrolled in any active class/section yet.</p>
            )}
          </DetailSection>

          {isAdmin && (
            <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
              <Button variant="ghost" onClick={() => onEnroll(student)}>
                <ArrowRightLeft size={14} />
                Enroll / transfer
              </Button>
              <Button variant="ghost" onClick={() => onEdit(student)}>
                <Pencil size={14} />
                Edit
              </Button>
              <Button variant="danger" onClick={() => onDelete(student)}>
                <Trash2 size={14} />
                Archive
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
