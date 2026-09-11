import { Fragment, useEffect, useMemo, useState } from "react";
import { Plus, Eye, Lock, History } from "lucide-react";
import AppLayout from "../components/AppLayout";
import DataTable from "../components/DataTable";
import Pagination from "../components/Pagination";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import Button from "../components/Button";
import ConfirmDialog from "../components/ConfirmDialog";
import { Field, TextInput, TextArea, Select } from "../components/FormFields";
import { testsApi } from "../api/tests";
import { academicSessionsApi, classesApi, sectionsApi, subjectsApi } from "../api/academicSetup";
import { staffApi } from "../api/staff";
import { teacherAssignmentsApi } from "../api/teacherAssignments";
import { fetchGradeDistribution } from "../api/dashboard";
import { useAuth } from "../context/AuthContext";
import { useResourceList } from "../lib/useResourceList";
import { useToast } from "../context/ToastContext";
import { formatDate } from "../lib/format";

// testsApi.list already returns the generic {items,...} shape.
const testsResource = { list: testsApi.list };

function byId(list) {
  return Object.fromEntries(list.filter((x) => x && x._id).map((x) => [x._id, x]));
}

// Dedupe a list of populated sub-documents (e.g. every assignment's
// `class`) by _id, since a teacher's assignments will repeat the same
// class/section/subject/session across rows.
function uniqueById(list) {
  const map = new Map();
  for (const item of list) {
    if (item && item._id) map.set(item._id, item);
  }
  return [...map.values()];
}

export default function Tests() {
  const { isAdmin, user } = useAuth();
  const toast = useToast();

  // class/section/subject/academicSession are never populated on a Test
  // itself (see api/tests.js), and sections/subjects/classes/sessions are
  // all admin-only routes (server/routes/{class,section,subject,academicSession}Routes.js)
  // — a teacher would get 403 calling them directly. So lookups branch by
  // role: admin fetches the real reference-data endpoints; a teacher
  // derives the exact same {_id -> name} maps from their own
  // teacher-assignments/mine, which is already populated with names and
  // is, by construction, the entire universe of combinations a teacher's
  // own tests could ever use.
  const [lookups, setLookups] = useState({
    loading: true,
    sessions: [],
    subjects: [],
    staffList: [],
    assignments: [],
    classesById: {},
    sectionsById: {},
    subjectsById: {},
    staffById: {},
  });

  const [sessionFilter, setSessionFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAdminLookups() {
      const [sessionsRes, classesRes, sectionsRes, subjectsRes, staffRes] = await Promise.all([
        academicSessionsApi.list({ limit: 100, sortBy: "startDate", sortDir: "desc" }),
        classesApi.list({ limit: 500 }),
        sectionsApi.list({ limit: 1000 }),
        subjectsApi.list({ limit: 200 }),
        staffApi.list({ limit: 300 }),
      ]);
      if (cancelled) return;
      const current = sessionsRes.items.find((s) => s.isCurrent);
      setSessionFilter(current?._id || "");
      setLookups({
        loading: false,
        sessions: sessionsRes.items,
        subjects: subjectsRes.items,
        staffList: staffRes.items,
        assignments: [],
        classesById: byId(classesRes.items),
        sectionsById: byId(sectionsRes.items),
        subjectsById: byId(subjectsRes.items),
        staffById: byId(staffRes.items),
      });
    }

    async function loadTeacherLookups() {
      const res = await teacherAssignmentsApi.mine();
      if (cancelled) return;
      const assignments = res.items || [];
      const sessions = uniqueById(assignments.map((a) => a.academicSession));
      const classes = uniqueById(assignments.map((a) => a.class));
      const sections = uniqueById(assignments.map((a) => a.section));
      const subjects = uniqueById(assignments.map((a) => a.subject));
      setLookups({
        loading: false,
        sessions,
        subjects,
        staffList: [],
        assignments,
        classesById: byId(classes),
        sectionsById: byId(sections),
        subjectsById: byId(subjects),
        staffById: {},
      });
    }

    (isAdmin ? loadAdminLookups() : loadTeacherLookups()).catch(() => {
      if (!cancelled) setLookups((l) => ({ ...l, loading: false }));
      toast.error("Couldn't load some reference data for the Tests page.");
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const list = useResourceList(testsResource, {
    academicSession: sessionFilter,
    subject: subjectFilter,
    status: statusFilter,
  });

  const [newOpen, setNewOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState(null);

  const className = (id) => lookups.classesById[id]?.name || "—";
  const sectionName = (id) => lookups.sectionsById[id]?.name || "—";
  const subjectLabel = (id) => {
    const s = lookups.subjectsById[id];
    if (!s) return "—";
    return s.code ? `${s.name} (${s.code})` : s.name;
  };
  const sessionName = (id) => lookups.sessions.find((s) => s._id === id)?.name || "—";
  const staffName = (id) => lookups.staffById[id]?.fullName || "—";

  const canCreate = isAdmin || lookups.assignments.length > 0;

  const columns = [
    { key: "title", header: "Title", render: (row) => <span className="font-medium text-ink-900">{row.title}</span> },
    {
      key: "classSection",
      header: "Class / Section",
      render: (row) => (
        <span>
          {className(row.class)} · {sectionName(row.section)}
        </span>
      ),
    },
    { key: "subject", header: "Subject", render: (row) => subjectLabel(row.subject) },
    { key: "session", header: "Session", render: (row) => sessionName(row.academicSession) },
    { key: "testDate", header: "Date", render: (row) => formatDate(row.testDate) },
    {
      key: "marks",
      header: "Marks",
      cellClassName: "font-tabular",
      render: (row) => `${row.passingMarks} / ${row.maxMarks}`,
    },
    ...(isAdmin
      ? [{ key: "createdBy", header: "Created by", render: (row) => staffName(row.createdBy) }]
      : []),
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "actions",
      header: "",
      headClassName: "w-16",
      render: (row) => (
        <div className="flex items-center justify-end">
          <button
            onClick={() => setDetailTarget(row)}
            className="p-1.5 text-ink-500 hover:text-ink-900"
            aria-label="View test"
            title="View test"
          >
            <Eye size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AppLayout title="Tests & Results">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <select
          value={sessionFilter}
          onChange={(e) => setSessionFilter(e.target.value)}
          className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-700"
        >
          <option value="">All sessions</option>
          {lookups.sessions.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
              {s.isCurrent ? " (current)" : ""}
            </option>
          ))}
        </select>

        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-700"
        >
          <option value="">All subjects</option>
          {lookups.subjects.map((s) => (
            <option key={s._id} value={s._id}>
              {s.code ? `${s.name} (${s.code})` : s.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-700"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="finalized">Finalized</option>
        </select>

        <div className="flex-1" />

        {!isAdmin && !lookups.loading && lookups.assignments.length === 0 && (
          <span className="text-xs text-ink-500">No class assignments yet — ask an admin to assign you first.</span>
        )}
        <Button onClick={() => setNewOpen(true)} disabled={!canCreate}>
          <Plus size={15} />
          New test
        </Button>
      </div>

      {list.error && (
        <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-4 py-3 text-sm text-brick-600">
          Couldn't load tests: {list.error.message}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={list.items}
        loading={list.loading}
        emptyMessage={
          isAdmin
            ? "No tests yet."
            : "No tests yet — create one for a class/section/subject you're assigned to."
        }
      />
      <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />

      <NewTestModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        isAdmin={isAdmin}
        sessions={lookups.sessions}
        subjects={lookups.subjects}
        staffList={lookups.staffList}
        assignments={lookups.assignments}
        defaultSession={sessionFilter}
        onSaved={() => {
          setNewOpen(false);
          list.refetch();
        }}
      />

      <TestDetailModal
        testRow={detailTarget}
        onClose={() => setDetailTarget(null)}
        isAdmin={isAdmin}
        currentStaffId={user?.staffId}
        classNameOf={className}
        sectionNameOf={sectionName}
        subjectLabelOf={subjectLabel}
        sessionNameOf={sessionName}
        onChanged={() => list.refetch()}
      />
    </AppLayout>
  );
}

const EMPTY_ADMIN_FORM = {
  createdBy: "",
  academicSession: "",
  class: "",
  section: "",
  subject: "",
  title: "",
  maxMarks: "",
  passingMarks: "0",
  testDate: "",
};

const EMPTY_TEACHER_FORM = {
  assignmentId: "",
  title: "",
  maxMarks: "",
  passingMarks: "0",
  testDate: "",
};

function NewTestModal({ open, onClose, isAdmin, sessions, subjects, staffList, assignments, defaultSession, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(isAdmin ? EMPTY_ADMIN_FORM : EMPTY_TEACHER_FORM);
  const [classesForSession, setClassesForSession] = useState([]);
  const [sectionsForClass, setSectionsForClass] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(
      isAdmin
        ? { ...EMPTY_ADMIN_FORM, academicSession: defaultSession || "" }
        : { ...EMPTY_TEACHER_FORM }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAdmin]);

  // Admin path only: classes depend on session, sections depend on class —
  // same dependent-dropdown chain as AssignmentFormModal in Staff.jsx.
  useEffect(() => {
    if (!isAdmin || !form.academicSession) {
      setClassesForSession([]);
      return;
    }
    classesApi
      .list({ limit: 200, academicSession: form.academicSession, status: "active" })
      .then((res) => setClassesForSession(res.items))
      .catch(() => {});
  }, [isAdmin, form.academicSession]);

  useEffect(() => {
    if (!isAdmin || !form.class) {
      setSectionsForClass([]);
      return;
    }
    sectionsApi
      .list({ limit: 200, class: form.class, status: "active" })
      .then((res) => setSectionsForClass(res.items))
      .catch(() => {});
  }, [isAdmin, form.class]);

  const selectedAssignment = useMemo(
    () => assignments.find((a) => a._id === form.assignmentId) || null,
    [assignments, form.assignmentId]
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        title: form.title,
        maxMarks: Number(form.maxMarks),
        passingMarks: Number(form.passingMarks || 0),
        testDate: form.testDate,
      };
      if (isAdmin) {
        body.createdBy = form.createdBy;
        body.class = form.class;
        body.section = form.section;
        body.subject = form.subject;
        body.academicSession = form.academicSession;
      } else {
        if (!selectedAssignment) {
          setError("Pick a class/section/subject assignment first");
          setSaving(false);
          return;
        }
        body.class = selectedAssignment.class._id;
        body.section = selectedAssignment.section._id;
        body.subject = selectedAssignment.subject._id;
        body.academicSession = selectedAssignment.academicSession._id;
      }
      await testsApi.create(body);
      toast.success("Test created");
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New test">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
            {error}
          </div>
        )}

        {isAdmin ? (
          <>
            <Field label="Teacher (createdBy)" required>
              <Select required value={form.createdBy} onChange={(e) => setForm({ ...form, createdBy: e.target.value })}>
                <option value="" disabled>
                  Select a teacher
                </option>
                {staffList.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.fullName}
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
                    {s.code ? `${s.name} (${s.code})` : s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : (
          <Field label="Class / Section / Subject" required>
            <Select
              required
              value={form.assignmentId}
              onChange={(e) => setForm({ ...form, assignmentId: e.target.value })}
            >
              <option value="" disabled>
                Select one of your assignments
              </option>
              {assignments.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.class?.name} · {a.section?.name} — {a.subject?.name}
                  {a.subject?.code ? ` (${a.subject.code})` : ""} ({a.academicSession?.name})
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Title" required>
          <TextInput
            required
            placeholder="e.g. Mid-term Mathematics"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Max marks" required>
            <TextInput
              type="number"
              min="1"
              required
              value={form.maxMarks}
              onChange={(e) => setForm({ ...form, maxMarks: e.target.value })}
            />
          </Field>
          <Field label="Passing marks">
            <TextInput
              type="number"
              min="0"
              value={form.passingMarks}
              onChange={(e) => setForm({ ...form, passingMarks: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Test date" required>
          <TextInput type="date" required value={form.testDate} onChange={(e) => setForm({ ...form, testDate: e.target.value })} />
        </Field>

        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create test"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TestDetailModal({
  testRow,
  onClose,
  isAdmin,
  currentStaffId,
  classNameOf,
  sectionNameOf,
  subjectLabelOf,
  sessionNameOf,
  onChanged,
}) {
  const toast = useToast();
  const [data, setData] = useState(null); // {test, results}
  const [loading, setLoading] = useState(false);
  const [gradeStats, setGradeStats] = useState(null);
  const [markEntryOpen, setMarkEntryOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [amendTarget, setAmendTarget] = useState(null); // a result row
  const [historyFor, setHistoryFor] = useState(null); // a result row, for the amendments toggle

  function load() {
    if (!testRow) return;
    setLoading(true);
    testsApi
      .getOne(testRow._id)
      .then(setData)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
    fetchGradeDistribution(testRow._id)
      .then(setGradeStats)
      .catch(() => setGradeStats(null));
  }

  useEffect(() => {
    setHistoryFor(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testRow]);

  const test = data?.test;
  const results = data?.results || [];
  // Anyone who can see this test at all can manage it: testController.list
  // scopes non-admins to filter.createdBy = req.user.staffId, so a teacher
  // never even sees another teacher's test in the list this modal is
  // opened from. Kept explicit anyway, matching loadTestForMutation's own
  // server-side check, rather than assuming the list scoping always holds.
  const canManage = isAdmin || (test && currentStaffId && String(test.createdBy) === String(currentStaffId));

  async function handleFinalize() {
    setFinalizing(true);
    try {
      await testsApi.finalize(test._id);
      toast.success("Test finalized — further corrections need an amendment.");
      setFinalizeOpen(false);
      load();
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <Modal
      open={!!testRow}
      onClose={onClose}
      title={test ? test.title : "Test"}
      width="max-w-2xl"
    >
      {loading && <p className="text-sm text-ink-500">Loading…</p>}

      {test && (
        <div>
          <div className="mb-4 flex items-start justify-between">
            <div className="text-sm text-ink-700">
              <div>
                {classNameOf(test.class)} · {sectionNameOf(test.section)} — {subjectLabelOf(test.subject)}
              </div>
              <div className="text-xs text-ink-500">
                {sessionNameOf(test.academicSession)} · {formatDate(test.testDate)} · Pass mark{" "}
                {test.passingMarks} / {test.maxMarks}
              </div>
            </div>
            <StatusBadge status={test.status} />
          </div>

          <div className="mb-4 grid grid-cols-4 gap-2">
            <StatBox label="Students" value={gradeStats?.totalStudents ?? results.length} />
            <StatBox label="Passed" value={gradeStats?.passCount ?? "—"} tone="text-moss-600" />
            <StatBox label="Failed" value={gradeStats?.failCount ?? "—"} tone="text-brick-600" />
            <StatBox label="Average" value={gradeStats ? gradeStats.averageMarks : "—"} />
          </div>

          {canManage && test.status === "draft" && (
            <div className="mb-4 flex gap-2">
              <Button variant="ghost" onClick={() => setMarkEntryOpen(true)}>
                {results.length > 0 ? "Enter / edit marks" : "Enter marks"}
              </Button>
              <Button variant="ghost" disabled={results.length === 0} onClick={() => setFinalizeOpen(true)}>
                <Lock size={14} />
                Finalize
              </Button>
            </div>
          )}

          <h3 className="mb-2 text-xs font-medium tracking-wide text-ink-600">RESULTS</h3>

          {results.length === 0 ? (
            <p className="text-sm text-ink-500">No marks entered yet.</p>
          ) : (
            <div className="overflow-hidden rounded-md border border-ink-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-100/60 text-left text-ink-600">
                    <th className="px-3 py-1.5 font-medium">Student</th>
                    <th className="px-3 py-1.5 text-right font-medium">Marks</th>
                    <th className="px-3 py-1.5 text-right font-medium">%</th>
                    <th className="px-3 py-1.5 font-medium">Grade</th>
                    <th className="px-3 py-1.5 font-medium">Result</th>
                    <th className="px-3 py-1.5 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <Fragment key={r._id}>
                      <tr className="border-b border-ink-100 last:border-0">
                        <td className="px-3 py-1.5">
                          <div className="font-medium text-ink-900">{r.student?.fullName}</div>
                          <div className="text-ink-500">{r.student?.admissionNumber}</div>
                        </td>
                        <td className="px-3 py-1.5 text-right font-tabular">{r.marksObtained}</td>
                        <td className="px-3 py-1.5 text-right font-tabular">{r.summary?.percentage}%</td>
                        <td className="px-3 py-1.5">{r.summary?.grade}</td>
                        <td className="px-3 py-1.5">
                          <span className={r.summary?.passed ? "text-moss-600" : "text-brick-600"}>
                            {r.summary?.passed ? "Pass" : "Fail"}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap">
                          {r.amendments?.length > 0 && (
                            <button
                              onClick={() => setHistoryFor(historyFor === r._id ? null : r._id)}
                              className="mr-2 inline-flex items-center gap-1 text-ink-500 hover:text-ink-900"
                              title="Amendment history"
                            >
                              <History size={12} />
                              {r.amendments.length}
                            </button>
                          )}
                          {canManage && test.status === "finalized" && (
                            <button
                              onClick={() => setAmendTarget(r)}
                              className="text-brass-600 hover:text-brass-700"
                            >
                              Amend
                            </button>
                          )}
                        </td>
                      </tr>
                      {historyFor === r._id &&
                        r.amendments?.map((a, i) => (
                          <tr key={`${r._id}-amend-${i}`} className="border-b border-ink-100 bg-paper-100/60 last:border-0">
                            <td colSpan={6} className="px-3 py-1.5 text-ink-600">
                              {a.previousMarks} → {a.newMarks} · {a.reason} ·{" "}
                              <span className="text-ink-400">{formatDate(a.amendedAt)}</span>
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <MarkEntryModal
            open={markEntryOpen}
            onClose={() => setMarkEntryOpen(false)}
            test={test}
            existingResults={results}
            onSaved={() => {
              setMarkEntryOpen(false);
              load();
              onChanged();
            }}
          />

          <ConfirmDialog
            open={finalizeOpen}
            onClose={() => setFinalizeOpen(false)}
            onConfirm={handleFinalize}
            busy={finalizing}
            title="Finalize test"
            confirmLabel="Finalize"
            message="This locks the test. After finalizing, marks can only be corrected via an amendment with a reason — they can no longer be edited directly."
          />

          <AmendModal
            open={!!amendTarget}
            onClose={() => setAmendTarget(null)}
            test={test}
            result={amendTarget}
            onSaved={() => {
              setAmendTarget(null);
              load();
              onChanged();
            }}
          />
        </div>
      )}
    </Modal>
  );
}

function StatBox({ label, value, tone = "text-ink-900" }) {
  return (
    <div className="rounded-md border border-ink-100 bg-paper-100/60 px-2.5 py-2 text-center">
      <div className={`font-tabular text-lg ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-ink-500">{label}</div>
    </div>
  );
}

function MarkEntryModal({ open, onClose, test, existingResults, onSaved }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !test) return;
    setError("");
    setLoading(true);
    const resultsByStudent = Object.fromEntries((existingResults || []).map((r) => [r.student?._id, r]));
    testsApi
      .roster(test._id)
      .then(({ roster }) => {
        setRows(
          roster.map((s) => ({
            student: s.student,
            fullName: s.fullName,
            admissionNumber: s.admissionNumber,
            rollNumber: s.rollNumber,
            marksObtained: resultsByStudent[s.student]?.marksObtained ?? "",
            remarks: resultsByStudent[s.student]?.remarks ?? "",
          }))
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, test]);

  function updateRow(student, patch) {
    setRows((prev) => prev.map((r) => (r.student === student ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const entries = rows
        .filter((r) => r.marksObtained !== "")
        .map((r) => ({ student: r.student, marksObtained: Number(r.marksObtained), remarks: r.remarks }));
      const res = await testsApi.enterMarks(test._id, { entries });
      toast.success(`Saved marks for ${res.savedCount} student(s)`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={test ? `Enter marks — ${test.title}` : "Enter marks"} width="max-w-2xl">
      {loading && <p className="text-sm text-ink-500">Loading roster…</p>}

      {!loading && test && (
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
              {error}
            </div>
          )}

          {rows.length === 0 ? (
            <p className="mb-4 text-sm text-ink-500">
              No active students are enrolled in this exact class/section/session yet.
            </p>
          ) : (
            <div className="mb-4 max-h-96 overflow-y-auto rounded-md border border-ink-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-ink-100/90">
                  <tr className="border-b border-ink-100 text-left text-ink-600">
                    <th className="px-3 py-1.5 font-medium">Roll #</th>
                    <th className="px-3 py-1.5 font-medium">Student</th>
                    <th className="px-3 py-1.5 font-medium w-24">Marks</th>
                    <th className="px-3 py-1.5 font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.student} className="border-b border-ink-100 last:border-0">
                      <td className="px-3 py-1.5 font-tabular">{r.rollNumber}</td>
                      <td className="px-3 py-1.5">
                        <div className="font-medium text-ink-900">{r.fullName}</div>
                        <div className="text-ink-500">{r.admissionNumber}</div>
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          min="0"
                          max={test.maxMarks}
                          value={r.marksObtained}
                          onChange={(e) => updateRow(r.student, { marksObtained: e.target.value })}
                          className="w-16 rounded border border-ink-200 px-1.5 py-1 text-xs outline-none focus:border-ink-700"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          value={r.remarks}
                          onChange={(e) => updateRow(r.student, { remarks: e.target.value })}
                          className="w-full rounded border border-ink-200 px-1.5 py-1 text-xs outline-none focus:border-ink-700"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || rows.length === 0}>
              {saving ? "Saving…" : "Save marks"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function AmendModal({ open, onClose, test, result, onSaved }) {
  const toast = useToast();
  const [newMarks, setNewMarks] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNewMarks(result ? String(result.marksObtained) : "");
    setReason("");
    setError("");
  }, [open, result]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await testsApi.amendMark(test._id, {
        student: result.student._id,
        newMarks: Number(newMarks),
        reason,
      });
      toast.success(`Amended ${result.student?.fullName}'s mark`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Amend mark" width="max-w-sm">
      {result && (
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
              {error}
            </div>
          )}
          <p className="mb-4 text-xs text-ink-500">
            <span className="font-medium text-ink-800">{result.student?.fullName}</span> — current marks:{" "}
            <span className="font-tabular">{result.marksObtained}</span> / {test.maxMarks}
          </p>
          <Field label="New marks" required>
            <TextInput
              type="number"
              min="0"
              max={test.maxMarks}
              required
              value={newMarks}
              onChange={(e) => setNewMarks(e.target.value)}
            />
          </Field>
          <Field label="Reason" required>
            <TextArea required value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save amendment"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
