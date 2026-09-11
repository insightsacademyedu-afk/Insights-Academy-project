import { useState } from "react";
import { Download } from "lucide-react";
import AppLayout from "../components/AppLayout";
import DataTable from "../components/DataTable";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import Button from "../components/Button";
import {
  fetchStudentsReport,
  fetchFeeCollectionReport,
  fetchOutstandingFeesReport,
  fetchExpensesReport,
  downloadReportCsv,
} from "../api/reports";
import { useFetch } from "../lib/useFetch";
import { useToast } from "../context/ToastContext";
import { formatCurrency, formatNumber, formatDate } from "../lib/format";

// All four routes are admin-only end to end (route-level `requireRole`,
// same as Fees/Salaries) and none of them paginate — see api/reports.js
// for why this page uses plain `useFetch` per tab instead of
// `useResourceList`. Each tab owns its own filter state and re-fetches on
// change; the CSV download re-requests the same endpoint with the same
// filters plus `format=csv` rather than being a separate action.

export default function Reports() {
  const [tab, setTab] = useState("students"); // students | fee-collection | outstanding-fees | expenses

  return (
    <AppLayout title="Reports">
      <div className="mb-5 inline-flex flex-wrap rounded-md border border-ink-200 bg-paper-50 p-0.5">
        {[
          { key: "students", label: "Students" },
          { key: "fee-collection", label: "Fee Collection" },
          { key: "outstanding-fees", label: "Outstanding Fees" },
          { key: "expenses", label: "Expenses" },
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

      {tab === "students" && <StudentsReportTab />}
      {tab === "fee-collection" && <FeeCollectionReportTab />}
      {tab === "outstanding-fees" && <OutstandingFeesReportTab />}
      {tab === "expenses" && <ExpensesReportTab />}
    </AppLayout>
  );
}

// Shared error banner + a "Download CSV" button wired to `downloadReportCsv`
// — kept as small local helpers rather than a new shared component since
// this page is the only place with a report-download action so far.

function ReportError({ message }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-4 py-3 text-sm text-brick-600">
      Couldn't load this report: {message}
    </div>
  );
}

function DownloadButton({ onDownload, disabled }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  async function handleClick() {
    setDownloading(true);
    try {
      await onDownload();
    } catch (err) {
      toast.error(err.message || "Couldn't download the CSV.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button variant="ghost" onClick={handleClick} disabled={disabled || downloading}>
      <Download size={14} />
      {downloading ? "Preparing…" : "Download CSV"}
    </Button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Students report
// ─────────────────────────────────────────────────────────────────────────

function StudentsReportTab() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [gender, setGender] = useState("");

  const { data, loading, error } = useFetch(
    () => fetchStudentsReport({ search, status, gender }),
    [search, status, gender]
  );

  const columns = [
    {
      key: "admissionNumber",
      header: "Admission #",
      cellClassName: "font-tabular text-ink-700",
      render: (row) => row.admissionNumber,
    },
    {
      key: "fullName",
      header: "Name",
      render: (row) => <span className="font-medium text-ink-900">{row.fullName}</span>,
    },
    { key: "gender", header: "Gender", render: (row) => <span className="capitalize">{row.gender}</span> },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "guardian",
      header: "Guardian",
      render: (row) => (
        <div>
          <div className="text-ink-800">{row.guardian?.fullName || "—"}</div>
          <div className="text-xs text-ink-500 font-tabular">{row.guardian?.primaryPhone || ""}</div>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or admission #…"
          className="w-60 rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-700/10"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-700"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-700"
        >
          <option value="">All genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>

        <div className="flex-1" />

        <DownloadButton
          disabled={loading}
          onDownload={() =>
            downloadReportCsv("/reports/students", { search, status, gender }, "students-report.csv")
          }
        />
      </div>

      <div className="mb-4">
        <StatCard label="Students matching filters" value={formatNumber(data?.total || 0)} />
      </div>

      <ReportError message={error?.message} />

      <DataTable
        columns={columns}
        rows={data?.items || []}
        loading={loading}
        emptyMessage="No students match these filters."
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Fee collection report
// ─────────────────────────────────────────────────────────────────────────

function FeeCollectionReportTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, loading, error } = useFetch(() => fetchFeeCollectionReport({ from, to }), [from, to]);

  const columns = [
    { key: "receiptNumber", header: "Receipt #", cellClassName: "font-tabular text-ink-700" },
    { key: "paidAt", header: "Date", render: (row) => formatDate(row.paidAt) },
    {
      key: "student",
      header: "Student",
      render: (row) => (
        <div>
          <div className="font-medium text-ink-900">{row.student?.fullName || "—"}</div>
          <div className="text-xs text-ink-500 font-tabular">{row.student?.admissionNumber || ""}</div>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      cellClassName: "font-tabular font-medium text-ink-950",
      render: (row) => formatCurrency(row.amount),
    },
    { key: "method", header: "Method", render: (row) => <span className="capitalize">{row.method}</span> },
  ];

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <DateRangeFields from={from} to={to} onFrom={setFrom} onTo={setTo} />

        <div className="flex-1" />

        <DownloadButton
          disabled={loading}
          onDownload={() =>
            downloadReportCsv("/reports/fee-collection", { from, to }, "fee-collection-report.csv")
          }
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <StatCard label="Total collected" value={formatCurrency(data?.total || 0)} tone="moss" />
        <StatCard label="Payments" value={formatNumber(data?.count || 0)} />
      </div>

      <ReportError message={error?.message} />

      <DataTable
        columns={columns}
        rows={data?.items || []}
        loading={loading}
        emptyMessage="No payments recorded in this range."
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Outstanding fees report — backend accepts no filters at all (see
// `reportController.js#outstandingFeesReport`: it reads only `format`
// from `req.query`), so this tab has a download button and a table, no
// filter bar.
// ─────────────────────────────────────────────────────────────────────────

function OutstandingFeesReportTab() {
  const { data, loading, error } = useFetch(() => fetchOutstandingFeesReport(), []);

  const columns = [
    {
      key: "student",
      header: "Student",
      render: (row) => (
        <div>
          <div className="font-medium text-ink-900">{row.student?.fullName || "—"}</div>
          <div className="text-xs text-ink-500 font-tabular">{row.student?.admissionNumber || ""}</div>
        </div>
      ),
    },
    { key: "period", header: "Period" },
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
      cellClassName: "font-tabular font-medium text-brick-600",
      render: (row) => formatCurrency(row.totalAmount - row.amountPaid),
    },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "dueDate", header: "Due date", render: (row) => formatDate(row.dueDate) },
  ];

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <DownloadButton
          disabled={loading}
          onDownload={() => downloadReportCsv("/reports/outstanding-fees", {}, "outstanding-fees-report.csv")}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <StatCard label="Total outstanding" value={formatCurrency(data?.totalOutstanding || 0)} tone="brick" />
        <StatCard label="Invoices" value={formatNumber(data?.count || 0)} />
      </div>

      <ReportError message={error?.message} />

      <DataTable
        columns={columns}
        rows={data?.items || []}
        loading={loading}
        emptyMessage="Nothing outstanding — every invoice is paid or waived."
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Expenses report
// ─────────────────────────────────────────────────────────────────────────

function ExpensesReportTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, loading, error } = useFetch(() => fetchExpensesReport({ from, to }), [from, to]);

  const columns = [
    { key: "expenseDate", header: "Date", render: (row) => formatDate(row.expenseDate) },
    { key: "category", header: "Category", render: (row) => row.category?.name || <span className="text-ink-400">—</span> },
    {
      key: "amount",
      header: "Amount",
      cellClassName: "font-tabular font-medium text-ink-950",
      render: (row) => formatCurrency(row.amount),
    },
    {
      key: "description",
      header: "Description",
      render: (row) => <span className="text-ink-600">{row.description || "—"}</span>,
    },
  ];

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <DateRangeFields from={from} to={to} onFrom={setFrom} onTo={setTo} />

        <div className="flex-1" />

        <DownloadButton
          disabled={loading}
          onDownload={() => downloadReportCsv("/reports/expenses", { from, to }, "expenses-report.csv")}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <StatCard label="Total expenses" value={formatCurrency(data?.total || 0)} />
        <StatCard label="Expenses recorded" value={formatNumber(data?.count || 0)} />
      </div>

      <ReportError message={error?.message} />

      <DataTable
        columns={columns}
        rows={data?.items || []}
        loading={loading}
        emptyMessage="No expenses recorded in this range."
      />
    </>
  );
}

// Shared by fee-collection and expenses — both filter on `{from, to}`
// against a date field server-side (`paidAt`/`expenseDate`), the only two
// reports that take a date range at all.
function DateRangeFields({ from, to, onFrom, onTo }) {
  return (
    <>
      <input
        type="date"
        value={from}
        onChange={(e) => onFrom(e.target.value)}
        aria-label="From date"
        className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-700"
      />
      <span className="text-ink-400 text-sm">to</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onTo(e.target.value)}
        aria-label="To date"
        className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-700"
      />
    </>
  );
}
