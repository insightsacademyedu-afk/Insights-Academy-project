import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, CircleDollarSign, Layers } from "lucide-react";
import AppLayout from "../components/AppLayout";
import DataTable from "../components/DataTable";
import Pagination from "../components/Pagination";
import ListToolbar from "../components/ListToolbar";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import Button from "../components/Button";
import { Field, TextInput, TextArea, Select } from "../components/FormFields";
import { salariesApi } from "../api/salaries";
import { expensesApi } from "../api/expenses";
import { expenseCategoriesApi } from "../api/expenseCategories";
import { staffApi } from "../api/staff";
import { useResourceList } from "../lib/useResourceList";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { formatCurrency, formatDate, toDateInputValue } from "../lib/format";

export default function Salaries() {
  const [tab, setTab] = useState("salaries"); // salaries | expenses | categories

  return (
    <AppLayout title="Salaries & Expenses">
      <div className="mb-5 inline-flex rounded-md border border-ink-200 bg-paper-50 p-0.5">
        {[
          { key: "salaries", label: "Salaries" },
          { key: "expenses", label: "Expenses" },
          { key: "categories", label: "Categories" },
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

      {tab === "salaries" && <SalariesTab />}
      {tab === "expenses" && <ExpensesTab />}
      {tab === "categories" && <CategoriesTab />}
    </AppLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Salaries tab
// ─────────────────────────────────────────────────────────────────────────

const SALARY_STATUSES = ["pending", "paid"];

// salariesApi.list already returns the generic {items,...} shape, so
// useResourceList works against it directly — it just isn't a
// createResourceApi instance (see api/salaries.js for why: no PUT/DELETE
// at all, a salary record is created once and only ever transitions
// pending → paid).
const salariesResource = { list: salariesApi.list };

function SalariesTab() {
  const toast = useToast();
  const [staffFilter, setStaffFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [staffOptions, setStaffOptions] = useState([]);

  useEffect(() => {
    staffApi
      .list({ limit: 200, status: "active" })
      .then((res) => setStaffOptions(res.items))
      .catch(() => {});
  }, []);

  const list = useResourceList(salariesResource, {
    staff: staffFilter,
    period: periodFilter,
    status: statusFilter,
  });

  const [newOpen, setNewOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [payTarget, setPayTarget] = useState(null); // salary row being marked paid

  const columns = [
    {
      key: "staff",
      header: "Staff",
      render: (row) => <span className="font-medium text-ink-900">{row.staff?.fullName || "—"}</span>,
    },
    { key: "period", header: "Period" },
    {
      key: "breakdown",
      header: "Base + bonuses − deductions",
      cellClassName: "font-tabular text-xs text-ink-600",
      render: (row) =>
        `${formatCurrency(row.baseAmount)} + ${formatCurrency(row.bonuses)} − ${formatCurrency(row.deductions)}`,
    },
    {
      key: "netAmount",
      header: "Net",
      cellClassName: "font-tabular font-medium text-ink-950",
      render: (row) => formatCurrency(row.netAmount),
    },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "paidAt", header: "Paid on", render: (row) => (row.paidAt ? formatDate(row.paidAt) : "—") },
    {
      key: "actions",
      header: "",
      headClassName: "w-28",
      render: (row) =>
        row.status === "pending" ? (
          <div className="flex justify-end">
            <Button variant="ghost" className="!py-1 !px-2.5 !text-xs" onClick={() => setPayTarget(row)}>
              <CircleDollarSign size={13} />
              Mark paid
            </Button>
          </div>
        ) : (
          <span className="block text-right text-xs text-ink-400">Locked</span>
        ),
    },
  ];

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <select
          value={staffFilter}
          onChange={(e) => setStaffFilter(e.target.value)}
          className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-700"
        >
          <option value="">All staff</option>
          {staffOptions.map((s) => (
            <option key={s._id} value={s._id}>
              {s.fullName}
            </option>
          ))}
        </select>

        <input
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          placeholder="Period, e.g. 2026-01"
          className="w-40 rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-700/10"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-700"
        >
          <option value="">All statuses</option>
          {SALARY_STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </select>

        <div className="flex-1" />

        <Button variant="ghost" onClick={() => setBulkOpen(true)}>
          <Layers size={15} />
          Bulk generate
        </Button>
        <Button onClick={() => setNewOpen(true)}>
          <Plus size={15} />
          New salary record
        </Button>
      </div>

      {list.error && (
        <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-4 py-3 text-sm text-brick-600">
          Couldn't load salary records: {list.error.message}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={list.items}
        loading={list.loading}
        emptyMessage="No salary records yet for these filters."
      />
      <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />

      <NewSalaryModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        staffOptions={staffOptions}
        onSaved={() => {
          setNewOpen(false);
          list.refetch();
        }}
      />

      <BulkSalaryModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onDone={() => list.refetch()}
      />

      <MarkPaidModal
        salary={payTarget}
        onClose={() => setPayTarget(null)}
        onSaved={(result) => {
          setPayTarget(null);
          list.refetch();
          toast.success(result?.expense ? "Salary marked as paid — a linked expense was recorded automatically" : "Zero-net salary settled; no expense was needed");
        }}
      />
    </>
  );
}

const EMPTY_BULK_SALARY_FORM = { period: "", bonuses: "", deductions: "", notes: "" };

function BulkSalaryModal({ open, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_BULK_SALARY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_BULK_SALARY_FORM);
    setError("");
    setResult(null);
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await salariesApi.bulkGenerate({
        period: form.period,
        bonuses: form.bonuses === "" ? 0 : Number(form.bonuses),
        deductions: form.deductions === "" ? 0 : Number(form.deductions),
        notes: form.notes,
      });
      setResult(response);
      onDone();
      toast.success(`${response.createdCount} salary record(s) created, ${response.skippedCount} skipped`);
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
    <Modal open={open} onClose={handleClose} title="Bulk generate salaries">
      {!result ? (
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
              {error}
            </div>
          )}
          <p className="mb-4 text-xs text-ink-500">
            Creates a pending salary record for every active staff member using each person's saved basic salary.
            Staff who already have a record for this period are skipped.
          </p>

          <Field label="Period" required>
            <TextInput
              required
              placeholder="e.g. 2026-01"
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Bonus for each staff member">
              <TextInput
                type="number"
                step="0.01"
                min="0"
                value={form.bonuses}
                onChange={(e) => setForm({ ...form, bonuses: e.target.value })}
              />
            </Field>
            <Field label="Deduction for each staff member">
              <TextInput
                type="number"
                step="0.01"
                min="0"
                value={form.deductions}
                onChange={(e) => setForm({ ...form, deductions: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Notes">
            <TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>

          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Generating…" : "Generate salaries"}</Button>
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
              {result.skipped.map((item) => (
                <div key={item.staff} className="border-b border-ink-100 px-3 py-2 text-xs last:border-0">
                  <span className="font-medium text-ink-800">{item.fullName}</span>
                  <span className="text-ink-500"> — {item.reason}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end"><Button onClick={handleClose}>Done</Button></div>
        </div>
      )}
    </Modal>
  );
}

const EMPTY_SALARY_FORM = { staff: "", period: "", baseAmount: "", bonuses: "", deductions: "", notes: "" };

function NewSalaryModal({ open, onClose, staffOptions, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_SALARY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_SALARY_FORM);
    setError("");
  }, [open]);

  const selectedStaff = staffOptions.find((s) => s._id === form.staff);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        staff: form.staff,
        period: form.period,
        bonuses: form.bonuses === "" ? 0 : Number(form.bonuses),
        deductions: form.deductions === "" ? 0 : Number(form.deductions),
        notes: form.notes,
      };
      // baseAmount is optional — omitted entirely (not sent as "") so the
      // backend's `baseAmount ?? staff.basicSalary` fallback in
      // salaryController.create actually kicks in, rather than sending an
      // empty string that would fail the model's Number/min validation.
      if (form.baseAmount !== "") body.baseAmount = Number(form.baseAmount);

      await salariesApi.create(body);
      toast.success(`Salary record created for ${selectedStaff?.fullName || "staff member"}`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New salary record">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
            {error}
          </div>
        )}

        <Field label="Staff" required>
          <Select required value={form.staff} onChange={(e) => setForm({ ...form, staff: e.target.value })}>
            <option value="" disabled>
              Select a staff member
            </option>
            {staffOptions.map((s) => (
              <option key={s._id} value={s._id}>
                {s.fullName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Period" required>
          <TextInput
            required
            placeholder="e.g. 2026-01"
            value={form.period}
            onChange={(e) => setForm({ ...form, period: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Base amount">
            <TextInput
              type="number"
              step="0.01"
              min="0"
              placeholder={selectedStaff ? String(selectedStaff.basicSalary) : "0"}
              value={form.baseAmount}
              onChange={(e) => setForm({ ...form, baseAmount: e.target.value })}
            />
          </Field>
          <Field label="Bonuses">
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={form.bonuses}
              onChange={(e) => setForm({ ...form, bonuses: e.target.value })}
            />
          </Field>
          <Field label="Deductions">
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={form.deductions}
              onChange={(e) => setForm({ ...form, deductions: e.target.value })}
            />
          </Field>
        </div>
        <p className="-mt-2.5 mb-4 text-xs text-ink-500">
          All amounts are PKR. Leave base amount blank to use the staff member's current basic salary.
        </p>

        <p className="mb-4 text-sm">Net salary: <strong>{formatCurrency(Math.max(0, Math.round(Number(form.baseAmount === '' ? selectedStaff?.basicSalary || 0 : form.baseAmount) * 100) + Math.round(Number(form.bonuses || 0) * 100) - Math.round(Number(form.deductions || 0) * 100)) / 100)}</strong></p>
        <Field label="Notes">
          <TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>

        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create record"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function MarkPaidModal({ salary, onClose, onSaved }) {
  const [categories, setCategories] = useState([]);
  const [expenseCategory, setExpenseCategory] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!salary) return;
    setExpenseCategory("");
    setError("");
    expenseCategoriesApi
      .list({ limit: 100, status: "active" })
      .then((res) => setCategories(res.items))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salary]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await salariesApi.markPaid(salary._id, { expenseCategory });
      onSaved(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!salary} onClose={onClose} title="Mark salary as paid" width="max-w-sm">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
            {error}
          </div>
        )}
        <p className="mb-4 text-xs text-ink-500">
          This records <span className="font-tabular font-medium text-ink-800">{formatCurrency(salary?.netAmount)}</span>{" "}
          as paid to <span className="font-medium text-ink-800">{salary?.staff?.fullName}</span> for{" "}
          {salary?.period}, and files a matching expense under the category you choose — both happen together
          or not at all. A zero-net salary is settled without creating an expense.
        </p>
        <Field label="Expense category" required>
          <Select required value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)}>
            <option value="" disabled>
              Select a category
            </option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Recording…" : "Mark paid"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Expenses tab
// ─────────────────────────────────────────────────────────────────────────

function ExpensesTab() {
  const toast = useToast();
  const { user } = useAuth();
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    expenseCategoriesApi
      .list({ limit: 200, status: "active" })
      .then((res) => setCategories(res.items))
      .catch(() => {});
  }, []);

  const list = useResourceList(expensesApi, { category: categoryFilter });

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
      await expensesApi.remove(deleteTarget._id, credentials);
      toast.success("Expense archived");
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
      key: "description",
      header: "Description",
      render: (row) => (
        <div>
          <div className="font-medium text-ink-900">{row.description || "—"}</div>
          {row.sourceSalaryPayment && (
            <div className="text-xs text-ink-500">Auto-generated from a salary payment</div>
          )}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (row) => row.category?.name || <span className="text-ink-400">—</span>,
    },
    {
      key: "amount",
      header: "Amount",
      cellClassName: "font-tabular font-medium",
      render: (row) => formatCurrency(row.amount),
    },
    { key: "expenseDate", header: "Date", render: (row) => formatDate(row.expenseDate) },
    {
      key: "recordedBy",
      header: "Recorded by",
      render: (row) => row.recordedBy?.username || <span className="text-ink-400">—</span>,
    },
    {
      key: "actions",
      header: "",
      headClassName: "w-20",
      render: (row) =>
        row.sourceSalaryPayment ? (
          <span className="block text-right text-xs text-ink-400">Locked</span>
        ) : (
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
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-700"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex-1" />

        <Button onClick={openCreate}>
          <Plus size={15} />
          New expense
        </Button>
      </div>

      {list.error && (
        <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-4 py-3 text-sm text-brick-600">
          Couldn't load expenses: {list.error.message}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={list.items}
        loading={list.loading}
        emptyMessage="No expenses recorded yet."
      />
      <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />

      <ExpenseFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        categories={categories}
        currentUserId={user?._id}
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
        title="Archive expense"
        message="Archive this manually recorded expense? It will be hidden from active reports and can be restored from Archive History."
      />
    </>
  );
}

const EMPTY_EXPENSE_FORM = { category: "", amount: "", description: "", expenseDate: "" };

function ExpenseFormModal({ open, onClose, editing, categories, currentUserId, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_EXPENSE_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (editing) {
      setForm({
        category: editing.category?._id || editing.category || "",
        amount: editing.amount,
        description: editing.description || "",
        expenseDate: toDateInputValue(editing.expenseDate),
      });
    } else {
      setForm(EMPTY_EXPENSE_FORM);
    }
  }, [open, editing]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = {
        category: form.category,
        amount: Number(form.amount),
        description: form.description,
        expenseDate: form.expenseDate || undefined,
      };
      if (editing) {
        await expensesApi.update(editing._id, body);
        toast.success("Expense updated");
      } else {
        // recordedBy is required by the model but the generic crudFactory
        // route has no dedicated controller setting it server-side (see
        // api/expenses.js) — fill it in from the logged-in admin here.
        await expensesApi.create({ ...body, recordedBy: currentUserId });
        toast.success("Expense recorded");
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit expense" : "New expense"}>
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
            {error}
          </div>
        )}
        <Field label="Category" required>
          <Select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="" disabled>
              Select a category
            </option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount" required>
            <TextInput
              type="number"
              min="0.01"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
          <Field label="Date">
            <TextInput
              type="date"
              value={form.expenseDate}
              onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Description">
          <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>

        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Record expense"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Categories tab (ExpenseCategory — plain reference data, same shape as
// Designations.jsx)
// ─────────────────────────────────────────────────────────────────────────

const EMPTY_CATEGORY_FORM = { name: "", description: "", status: "active" };

function CategoriesTab() {
  const list = useResourceList(expenseCategoriesApi);
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_CATEGORY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_CATEGORY_FORM);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({ name: row.name, description: row.description || "", status: row.status });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await expenseCategoriesApi.update(editing._id, form);
        toast.success("Category updated");
      } else {
        await expenseCategoriesApi.create(form);
        toast.success("Category created");
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
      await expenseCategoriesApi.remove(deleteTarget._id, credentials);
      toast.success("Category archived");
      setDeleteTarget(null);
      list.refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const columns = [
    { key: "name", header: "Name", render: (row) => <span className="font-medium text-ink-900">{row.name}</span> },
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
    <>
      <ListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        searchPlaceholder="Search categories…"
        status={list.status}
        onStatusChange={list.setStatus}
        onCreate={openCreate}
        createLabel="New category"
      />

      {list.error && (
        <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-4 py-3 text-sm text-brick-600">
          Couldn't load categories: {list.error.message}
        </div>
      )}

      <DataTable columns={columns} rows={list.items} loading={list.loading} emptyMessage="No expense categories yet." />
      <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit category" : "New category"}>
        <form onSubmit={handleSubmit}>
          {formError && (
            <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
              {formError}
            </div>
          )}
          <Field label="Name" required>
            <TextInput
              required
              placeholder="e.g. Utilities"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
              {saving ? "Saving…" : editing ? "Save changes" : "Create category"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        busy={deleting}
        title="Archive category"
        message={`Archive "${deleteTarget?.name}"? It will be hidden from active category lists while existing financial records remain intact.`}
      />
    </>
  );
}
