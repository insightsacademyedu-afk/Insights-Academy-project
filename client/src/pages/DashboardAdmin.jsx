import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import AppLayout from "../components/AppLayout";
import StatCard from "../components/StatCard";
import Panel from "../components/Panel";
import { fetchAdminSummary } from "../api/dashboard";
import { useFetch } from "../lib/useFetch";
import { formatCurrency, formatNumber } from "../lib/format";

export default function DashboardAdmin() {
  const { data, loading, error } = useFetch(fetchAdminSummary, []);

  return (
    <AppLayout title="Dashboard">
      {loading && <LoadingState />}
      {error && <ErrorState message={error.message} />}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Active students"
              value={formatNumber(data.students.active || 0)}
              sub={data.students.inactive ? `${formatNumber(data.students.inactive)} inactive` : "All enrolled"}
            />
            <StatCard
              label="Active staff"
              value={formatNumber(data.staff.active || 0)}
              sub={data.staff.inactive ? `${formatNumber(data.staff.inactive)} inactive` : "All active"}
            />
            <StatCard
              label="Fees collected"
              value={formatCurrency(data.fees.totalCollected)}
              sub={`of ${formatCurrency(data.fees.totalBilled)} billed`}
              tone="moss"
            />
            <StatCard
              label="Outstanding fees"
              value={formatCurrency(data.fees.outstanding)}
              sub={`${formatNumber(data.fees.invoiceCount)} invoices`}
              tone={data.fees.outstanding > 0 ? "brick" : "ink"}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Panel title="Fee collection" className="lg:col-span-2">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Billed", amount: data.fees.totalBilled },
                      { name: "Collected", amount: data.fees.totalCollected },
                      { name: "Outstanding", amount: data.fees.outstanding },
                    ]}
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#eae7dd" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#55658a" }} axisLine={{ stroke: "#dbd6c8" }} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#55658a" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => formatCurrency(v)}
                      width={70}
                    />
                    <Tooltip formatter={(v) => formatCurrency(v)} cursor={{ fill: "#f4f2ec" }} />
                    <Bar dataKey="amount" fill="#c7952f" radius={[3, 3, 0, 0]} maxBarSize={80} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Salaries">
              <SalaryBreakdown salaries={data.salaries} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Panel title="Expenses">
              <div className="font-tabular text-2xl text-ink-950">{formatCurrency(data.expenses.totalExpenses)}</div>
              <div className="text-sm text-ink-500 mt-1">{formatNumber(data.expenses.count)} recorded expenses</div>
            </Panel>
            <Panel title="Enrollment" className="lg:col-span-2">
              <StatusBars label="Students" counts={data.students} />
              <div className="h-3" />
              <StatusBars label="Staff" counts={data.staff} />
            </Panel>
          </div>

        </div>
      )}
    </AppLayout>
  );
}

function SalaryBreakdown({ salaries }) {
  const pending = salaries?.pending || { count: 0, total: 0 };
  const paid = salaries?.paid || { count: 0, total: 0 };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-ink-700">Paid</div>
        <div className="text-right">
          <div className="font-tabular text-ink-950">{formatCurrency(paid.total)}</div>
          <div className="text-xs text-ink-500">{formatNumber(paid.count)} payments</div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-ink-700">Pending</div>
        <div className="text-right">
          <div className="font-tabular text-amber-600">{formatCurrency(pending.total)}</div>
          <div className="text-xs text-ink-500">{formatNumber(pending.count)} payments</div>
        </div>
      </div>
    </div>
  );
}

function StatusBars({ label, counts }) {
  const entries = Object.entries(counts || {});
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <div>
      <div className="text-xs font-medium text-ink-500 mb-1.5">{label}</div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
        {entries.map(([key, value], i) => (
          <div
            key={key}
            title={`${key}: ${value}`}
            style={{
              width: `${(value / total) * 100}%`,
              backgroundColor: key === "active" ? "#c7952f" : ["#3f6b4a", "#a34331", "#7684a3"][i % 3],
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-500 capitalize">
        {entries.map(([key, value]) => (
          <span key={key}>
            {key}: <span className="font-tabular text-ink-800">{formatNumber(value)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 rounded-lg border border-ink-200 bg-paper-50 animate-pulse" />
      ))}
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="rounded-lg border border-brick-600/30 bg-brick-100 px-5 py-4 text-sm text-brick-600">
      Couldn't load the dashboard: {message}
    </div>
  );
}
