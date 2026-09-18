import { useEffect, useState } from "react";
import { Plus, Layers, Eye, X, Printer } from "lucide-react";
import AppLayout from "../components/AppLayout";
import DataTable from "../components/DataTable";
import Pagination from "../components/Pagination";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import Button from "../components/Button";
import { Field, TextInput, TextArea, Select } from "../components/FormFields";
import { feesApi } from "../api/fees";
import { studentsApi } from "../api/students";
import { academicSessionsApi, classesApi, sectionsApi } from "../api/academicSetup";
import { useResourceList } from "../lib/useResourceList";
import { useToast } from "../context/ToastContext";
import { useAcademy } from "../context/academy";
import { formatCurrency, formatDate } from "../lib/format";

// feesApi.listInvoices already returns the generic {items,...} shape, so
// useResourceList works against it directly — it just isn't a
// createResourceApi instance (see api/fees.js for why).
const invoicesResource = { list: feesApi.listInvoices };

const INVOICE_STATUSES = ["unpaid", "partially_paid", "paid", "overdue", "waived"];
const INVOICE_TYPES = ["tuition", "admission", "exam", "other"];

export default function Fees() {
  const [sessions, setSessions] = useState([]);
  const [sessionFilter, setSessionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState(null); // {_id, fullName, admissionNumber} | null

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

  const list = useResourceList(invoicesResource, {
    academicSession: sessionFilter,
    status: statusFilter,
    invoiceType: typeFilter,
    student: studentFilter?._id || "",
  });

  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState(null); // invoice row

  const columns = [
    {
      key: "student",
      header: "Student",
      render: (row) => (
        <div>
          <div className="font-medium text-ink-900">{row.student?.fullName || "—"}</div>
          <div className="text-xs text-ink-500">{row.student?.admissionNumber || ""}</div>
        </div>
      ),
    },
    { key: "period", header: "Period" },
    {
      key: "invoiceType",
      header: "Type",
      render: (row) => <span className="capitalize">{row.invoiceType}</span>,
    },
    {
      key: "totalAmount",
      header: "Total",
      cellClassName: "font-tabular",
      render: (row) => formatCurrency(row.totalAmount),
    },
    {
      key: "amountPaid",
      header: "Paid",
      cellClassName: "font-tabular",
      render: (row) => formatCurrency(row.amountPaid),
    },
    {
      key: "outstanding",
      header: "Outstanding",
      cellClassName: "font-tabular",
      render: (row) =>
        row.status === "waived" ? (
          <span className="text-ink-400">—</span>
        ) : (
          formatCurrency(Math.max(0, row.totalAmount - row.amountPaid))
        ),
    },
    { key: "dueDate", header: "Due", render: (row) => formatDate(row.dueDate) },
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
            aria-label="View invoice"
            title="View invoice"
          >
            <Eye size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AppLayout title="Fees">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <StudentFilterInput value={studentFilter} onChange={setStudentFilter} />

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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-700"
        >
          <option value="">All statuses</option>
          {INVOICE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-700"
        >
          <option value="">All types</option>
          {INVOICE_TYPES.map((t) => (
            <option key={t} value={t} className="capitalize">
              {t}
            </option>
          ))}
        </select>

        <div className="flex-1" />

        <Button variant="ghost" onClick={() => setBulkOpen(true)}>
          <Layers size={15} />
          Bulk generate
        </Button>
        <Button onClick={() => setNewInvoiceOpen(true)}>
          <Plus size={15} />
          New invoice
        </Button>
      </div>

      {list.error && (
        <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-4 py-3 text-sm text-brick-600">
          Couldn't load invoices: {list.error.message}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={list.items}
        loading={list.loading}
        emptyMessage="No invoices yet — generate one for a student, or use bulk generate for a whole class/section."
      />
      <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />

      <NewInvoiceModal
        open={newInvoiceOpen}
        onClose={() => setNewInvoiceOpen(false)}
        sessions={sessions}
        defaultSession={sessionFilter}
        onSaved={() => {
          setNewInvoiceOpen(false);
          list.refetch();
        }}
      />

      <BulkGenerateModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        sessions={sessions}
        defaultSession={sessionFilter}
        onDone={() => list.refetch()}
      />

      <InvoiceDetailModal
        invoiceRow={detailTarget}
        onClose={() => setDetailTarget(null)}
        onChanged={() => {
          list.refetch();
        }}
      />
    </AppLayout>
  );
}

// A small debounced student search-select. Not a shared component yet —
// this is the first page that needs to pick a student out of a paginated
// list rather than showing the whole Students screen, so it's kept local
// until a second page needs the same thing.
function StudentFilterInput({ value, onChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      studentsApi
        .list({ search: query, limit: 8, status: "active" })
        .then((res) => setResults(res.items))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  if (value) {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800">
        <span className="font-medium text-ink-900">{value.fullName}</span>
        <span className="text-ink-400">({value.admissionNumber})</span>
        <button
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
          className="ml-1 text-ink-400 hover:text-ink-900"
          aria-label="Clear student filter"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-56">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Filter by student…"
        className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-700/10"
      />
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-ink-200 bg-white shadow-lg shadow-ink-950/10">
          {results.map((s) => (
            <button
              key={s._id}
              type="button"
              onMouseDown={() => {
                onChange(s);
                setQuery("");
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-paper-100"
            >
              <div className="font-medium text-ink-900">{s.fullName}</div>
              <div className="text-xs text-ink-500">{s.admissionNumber}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const OVERRIDE_FIELDS = [
  { key: "monthlyTuition", label: "Monthly tuition" },
  { key: "admissionFee", label: "Admission fee" },
  { key: "examFee", label: "Exam fee" },
  { key: "otherFee", label: "Other fee" },
  { key: "discount", label: "Discount" },
  { key: "scholarship", label: "Scholarship" },
];

function NewInvoiceModal({ open, onClose, sessions, defaultSession, onSaved }) {
  const toast = useToast();
  const [student, setStudent] = useState(null);
  const [academicSession, setAcademicSession] = useState("");
  const [period, setPeriod] = useState("");
  const [invoiceType, setInvoiceType] = useState("tuition");
  const [dueDate, setDueDate] = useState("");
  const [useOverrides, setUseOverrides] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStudent(null);
    setAcademicSession(defaultSession || "");
    setPeriod("");
    setInvoiceType("tuition");
    setDueDate("");
    setUseOverrides(false);
    setOverrides({});
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!student) {
      setError("Pick a student first");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        student: student._id,
        academicSession,
        period,
        invoiceType,
        dueDate,
      };
      if (useOverrides) {
        body.overrides = Object.fromEntries(
          Object.entries(overrides).filter(([, v]) => v !== "" && v !== undefined)
        );
      }
      await feesApi.createInvoice(body);
      toast.success(`Invoice created for ${student.fullName}`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const defaults = Object.fromEntries(OVERRIDE_FIELDS.map(({key}) => [key,
    (invoiceType === 'tuition' ? ['monthlyTuition','discount','scholarship'].includes(key) : ({admission:'admissionFee',exam:'examFee',other:'otherFee'}[invoiceType] === key)) ? Number(student?.feeDetails?.[key] || 0) : 0]));
  const amounts = Object.fromEntries(OVERRIDE_FIELDS.map(({key}) => [key, useOverrides && overrides[key] !== undefined && overrides[key] !== '' ? Number(overrides[key]) : defaults[key]]));
  const preview = Math.max(0, OVERRIDE_FIELDS.reduce((sum,{key}) => sum + (['discount','scholarship'].includes(key) ? -1 : 1) * Math.round(amounts[key]*100),0))/100;
  return (
    <Modal open={open} onClose={onClose} title="New invoice">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
            {error}
          </div>
        )}

        <p className="mb-4 text-sm">Invoice total: <strong>{formatCurrency(preview)}</strong></p>
        <Field label="Student" required>
          <InlineStudentPicker value={student} onChange={setStudent} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Academic session" required>
            <Select required value={academicSession} onChange={(e) => setAcademicSession(e.target.value)}>
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
          <Field label="Invoice type">
            <Select value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)}>
              {INVOICE_TYPES.map((t) => (
                <option key={t} value={t} className="capitalize">
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Period" required>
            <TextInput
              required
              placeholder="e.g. 2026-01"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </Field>
          <Field label="Due date" required>
            <TextInput type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>

        <label className="mb-3 flex items-center gap-2 text-xs font-medium text-ink-600">
          <input type="checkbox" checked={useOverrides} onChange={(e) => setUseOverrides(e.target.checked)} />
          Override amounts in PKR (defaults use only the selected invoice type; tuition includes discount and scholarship)
        </label>

        {useOverrides && (
          <div className="mb-4 grid grid-cols-2 gap-3 rounded-md border border-ink-100 bg-paper-100/60 p-3">
            {OVERRIDE_FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={
                    (invoiceType === "tuition" ? ["monthlyTuition", "discount", "scholarship"].includes(f.key) : ({ admission: "admissionFee", exam: "examFee", other: "otherFee" }[invoiceType] === f.key)) ? String(student?.feeDetails?.[f.key] || 0) : "0"
                  }
                  value={overrides[f.key] ?? ""}
                  onChange={(e) => setOverrides({ ...overrides, [f.key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create invoice"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// Same search-as-you-type pattern as StudentFilterInput, but sized/styled
// to sit inside a Field rather than a toolbar, and without the "clear"
// affordance living in the collapsed state (the field itself is small).
function InlineStudentPicker({ value, onChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      studentsApi
        .list({ search: query, limit: 8, status: "active" })
        .then((res) => setResults(res.items))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border border-ink-200 bg-paper-100/60 px-3 py-2 text-sm">
        <span>
          <span className="font-medium text-ink-900">{value.fullName}</span>{" "}
          <span className="text-ink-500">({value.admissionNumber})</span>
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-ink-400 hover:text-ink-900"
          aria-label="Change student"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <TextInput
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search by name or admission #…"
      />
      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-md border border-ink-200 bg-white shadow-lg shadow-ink-950/10">
          {results.map((s) => (
            <button
              key={s._id}
              type="button"
              onMouseDown={() => {
                onChange(s);
                setOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-paper-100"
            >
              <div className="font-medium text-ink-900">{s.fullName}</div>
              <div className="text-xs text-ink-500">{s.admissionNumber}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const EMPTY_BULK_FORM = {
  academicSession: "",
  class: "",
  section: "",
  invoiceType: "tuition",
  amountOverride: "",
  period: "",
  dueDate: "",
};

function BulkGenerateModal({ open, onClose, sessions, defaultSession, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_BULK_FORM);
  const [classesForSession, setClassesForSession] = useState([]);
  const [sectionsForClass, setSectionsForClass] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // {createdCount, skippedCount, skipped}

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY_BULK_FORM, academicSession: defaultSession || "" });
    setError("");
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
      const res = await feesApi.bulkGenerateInvoices(form);
      setResult(res);
      onDone();
      toast.success(`${res.createdCount} invoice(s) created, ${res.skippedCount} skipped`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setResult(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Bulk generate invoices">
      {!result ? (
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
              {error}
            </div>
          )}
          <p className="mb-4 text-xs text-ink-500">
            Generates one selected fee invoice per active student in the chosen class/section. Existing
            invoices of the same type and period are skipped, not overwritten.
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Invoice type" required>
              <Select
                required
                value={form.invoiceType}
                onChange={(e) => setForm({ ...form, invoiceType: e.target.value })}
              >
                {INVOICE_TYPES.map((type) => (
                  <option key={type} value={type} className="capitalize">
                    {type}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Amount for each student">
              <TextInput
                type="number"
                step="0.01"
                min="0"
                placeholder="Use each student's fee"
                value={form.amountOverride}
                onChange={(e) => setForm({ ...form, amountOverride: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Period" required>
              <TextInput
                required
                placeholder="e.g. 2026-01"
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
              />
            </Field>
            <Field label="Due date" required>
              <TextInput
                type="date"
                required
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Generating…" : "Generate"}
            </Button>
          </div>
        </form>
      ) : (
        <div>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-moss-600/30 bg-moss-100 px-3 py-3 text-center">
              <div className="font-tabular text-2xl text-moss-600">{result.createdCount}</div>
              <div className="text-xs text-moss-600">created</div>
            </div>
            <div className="rounded-md border border-ink-200 bg-paper-100 px-3 py-3 text-center">
              <div className="font-tabular text-2xl text-ink-700">{result.skippedCount}</div>
              <div className="text-xs text-ink-600">skipped</div>
            </div>
          </div>

          {result.skipped?.length > 0 && (
            <div className="mb-4 max-h-40 overflow-y-auto rounded-md border border-ink-100">
              <table className="w-full text-xs">
                <tbody>
                  {result.skipped.map((s, i) => (
                    <tr key={i} className="border-b border-ink-100 last:border-0">
                      <td className="px-3 py-1.5 text-ink-600">{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleClose}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function InvoiceDetailModal({ invoiceRow, onClose, onChanged }) {
  const toast = useToast();
  const { settings } = useAcademy();
  const [data, setData] = useState(null); // {invoice, payments}
  const [loading, setLoading] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [waiveOpen, setWaiveOpen] = useState(false);

  useEffect(() => {
    if (!invoiceRow) {
      setData(null);
      return;
    }
    setLoading(true);
    feesApi
      .getInvoice(invoiceRow._id)
      .then(setData)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceRow]);

  function refresh() {
    if (!invoiceRow) return;
    feesApi.getInvoice(invoiceRow._id).then(setData).catch(() => {});
  }

  const invoice = data?.invoice;
  const outstanding = invoice && invoice.status !== "waived" ? Math.max(0, invoice.totalAmount - invoice.amountPaid) : 0;
  const canPay = invoice && !["paid", "waived"].includes(invoice.status);

  return (
    <Modal
      open={!!invoiceRow}
      onClose={onClose}
      title={invoice ? `Invoice — ${invoice.student?.fullName || ""}` : "Invoice"}
      width="max-w-lg"
    >
      {loading && <p className="text-sm text-ink-500">Loading…</p>}

      {invoice && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-ink-500">
                {invoice.student?.admissionNumber} · {invoice.period} ·{" "}
                <span className="capitalize">{invoice.invoiceType}</span>
              </div>
              <div className="text-xs text-ink-500">Due {formatDate(invoice.dueDate)}</div>
            </div>
            <StatusBadge status={invoice.status} />
          </div>

          <div className="mb-4 rounded-md border border-ink-100 bg-paper-100/60 p-3 text-sm">
            {[
              ["Monthly tuition", invoice.monthlyTuition],
              ["Admission fee", invoice.admissionFee],
              ["Exam fee", invoice.examFee],
              ["Other fee", invoice.otherFee],
              ["Discount", -invoice.discount],
              ["Scholarship", -invoice.scholarship],
            ]
              .filter(([, v]) => v)
              .map(([label, v]) => (
                <div key={label} className="flex justify-between py-0.5 text-ink-700">
                  <span>{label}</span>
                  <span className="font-tabular">{formatCurrency(v)}</span>
                </div>
              ))}
            <div className="mt-1.5 flex justify-between border-t border-ink-200 pt-1.5 font-medium text-ink-950">
              <span>Total</span>
              <span className="font-tabular">{formatCurrency(invoice.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-moss-600">
              <span>Paid</span>
              <span className="font-tabular">{formatCurrency(invoice.amountPaid)}</span>
            </div>
            <div className="flex justify-between font-medium text-brick-600">
              <span>Outstanding</span>
              <span className="font-tabular">{formatCurrency(outstanding)}</span>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium tracking-wide text-ink-600">PAYMENTS</h3>
            {invoice.status === "paid" && invoice.amountPaid > 0 && <Button variant="ghost" onClick={() => setPaymentOpen(true)}>Adjust payment</Button>}
            {canPay && (
              <div className="flex gap-2">
                <Button variant="ghost" className="!py-1 !px-2.5 !text-xs" onClick={() => setWaiveOpen(true)}>
                  Waive
                </Button>
                <Button variant="ghost" className="!py-1 !px-2.5 !text-xs" onClick={() => setPaymentOpen(true)}>
                  Record payment
                </Button>
              </div>
            )}
          </div>

          {data.payments.length === 0 ? (
            <p className="text-sm text-ink-500">No payments recorded yet.</p>
          ) : (
            <div className="overflow-hidden rounded-md border border-ink-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-100/60 text-left text-ink-600">
                    <th className="px-3 py-1.5 font-medium">Receipt</th>
                    <th className="px-3 py-1.5 font-medium">Method</th>
                    <th className="px-3 py-1.5 font-medium">Date</th>
                    <th className="px-3 py-1.5 text-right font-medium">Amount</th>
                    <th className="px-3 py-1.5 font-medium">Print</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p) => (
                    <tr key={p._id} className="border-b border-ink-100 last:border-0">
                      <td className="px-3 py-1.5 font-tabular">{p.receiptNumber}</td>
                      <td className="px-3 py-1.5 capitalize">{p.method.replace(/_/g, " ")}</td>
                      <td className="px-3 py-1.5">{formatDate(p.paidAt)}</td>
                      <td className="px-3 py-1.5 text-right font-tabular">{formatCurrency(p.amount)}</td>
                      <td className="px-3 py-1.5"><button type="button" className="text-ink-600 hover:text-ink-950" aria-label={`Print receipt ${p.receiptNumber}`} onClick={() => printReceipt(p, invoice, settings)}><Printer size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <RecordPaymentModal
            open={paymentOpen}
            onClose={() => setPaymentOpen(false)}
            invoice={invoice}
            outstanding={outstanding}
            onSaved={() => {
              setPaymentOpen(false);
              refresh();
              onChanged();
            }}
          />
          <WaiveInvoiceModal
            open={waiveOpen}
            onClose={() => setWaiveOpen(false)}
            invoice={invoice}
            onSaved={() => {
              setWaiveOpen(false);
              refresh();
              onChanged();
            }}
          />
        </div>
      )}
    </Modal>
  );
}

function printReceipt(payment, invoice, settings) {
  const popup = window.open('', '_blank', 'width=520,height=700');
  if (!popup) return;
  const doc = popup.document;
  doc.title = `Receipt ${payment.receiptNumber}`;
  const style = doc.createElement('style');
  style.textContent = 'body{font-family:Arial,sans-serif;color:#172033;padding:32px;max-width:520px;margin:auto}h1{text-align:center;margin:0 0 4px}p{text-align:center;margin:4px}.line{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:10px 0}.total{font-size:20px;font-weight:bold}.footer{margin-top:32px;border-top:1px solid #aaa;padding-top:16px;white-space:pre-wrap}@media print{body{padding:0}}';
  doc.head.appendChild(style);
  const add = (tag, text, className = '') => { const node = doc.createElement(tag); node.textContent = text; if (className) node.className = className; doc.body.appendChild(node); return node; };
  add('h1', settings.receiptName || settings.academyName || 'Academy Management');
  const phone = settings.receiptPhone || settings.academyPhone;
  if (phone) add('p', phone);
  add('p', `Payment receipt · ${payment.receiptNumber}`);
  for (const [label, value, className] of [
    ['Student', invoice.student?.fullName || ''],
    ['Admission number', invoice.student?.admissionNumber || ''],
    ['Invoice period', invoice.period],
    ['Payment date', formatDate(payment.paidAt)],
    ['Method', payment.method.replace(/_/g, ' ')],
    ['Amount received', formatCurrency(payment.amount), 'total'],
  ]) {
    const row = add('div', '', `line ${className}`); const left = doc.createElement('span'); const right = doc.createElement('span');
    left.textContent = label; right.textContent = value; row.append(left, right);
  }
  if (settings.receiptFooter) add('div', settings.receiptFooter, 'footer');
  popup.focus(); popup.print();
}

// Marks the remaining balance as administratively excused rather than
// collected — matches feeController.waiveInvoice: 409 if already waived,
// 400 if already fully paid (both cases are pre-empted here by canPay
// already hiding the button for those two statuses, so this modal is only
// ever reachable when the waive is expected to succeed).
function WaiveInvoiceModal({ open, onClose, invoice, onSaved }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setError("");
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await feesApi.waiveInvoice(invoice._id, { reason: reason || undefined });
      toast.success("Invoice waived");
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Waive invoice" width="max-w-sm">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
            {error}
          </div>
        )}
        <p className="mb-4 text-xs text-ink-500">
          This excuses the remaining balance administratively — it isn't a payment, and the outcome is sticky:
          recording a payment later can't change it back.
        </p>
        <Field label="Reason">
          <TextArea
            placeholder="e.g. financial hardship, scholarship exception"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Waiving…" : "Waive invoice"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RecordPaymentModal({ open, onClose, invoice, outstanding, onSaved }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setMethod(invoice?.status === "paid" ? "adjustment" : "cash");
    setReference("");
    setNotes("");
    setError("");
  }, [open, invoice?.status]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await feesApi.recordPayment({
        invoice: invoice._id,
        amount: Number(amount),
        method,
        reference,
        notes,
      });
      toast.success(`Payment recorded — receipt ${res.payment.receiptNumber}`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record payment" width="max-w-sm">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
            {error}
          </div>
        )}
        <p className="mb-4 text-xs text-ink-500">
          Remaining balance: <span className="font-tabular font-medium text-ink-800">{formatCurrency(outstanding)}</span>
        </p>
        <Field label="Amount" required>
          <TextInput
            type="number"
            step="0.01"
            min={method === "adjustment" ? -Number(invoice?.amountPaid || 0) : 0.01}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Method" required>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="card">Card</option>
            <option value="online">Online</option>
            <option value="adjustment">Adjustment</option>
          </Select>
        </Field>
        {method === "adjustment" && <p className="mb-4 text-xs text-ink-600">Enter a negative PKR amount to reverse a payment. You cannot reverse more than the total paid. Add a reference or note for the audit trail.</p>}
        <Field label="Reference">
          <TextInput
            placeholder="e.g. bank slip / transaction id"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </Field>
        <Field label="Notes">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Recording…" : "Record payment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
