import AppLayout from "../components/AppLayout";
import StatCard from "../components/StatCard";
import Panel from "../components/Panel";
import { fetchTeacherSummary } from "../api/dashboard";
import { useFetch } from "../lib/useFetch";
import { formatNumber } from "../lib/format";

export default function DashboardTeacher() {
  const { data, loading, error } = useFetch(fetchTeacherSummary, []);

  return (
    <AppLayout title="My Dashboard">
      {loading && (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg border border-ink-200 bg-paper-50 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-brick-600/30 bg-brick-100 px-5 py-4 text-sm text-brick-600">
          Couldn't load your dashboard: {error.message}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <StatCard label="My students" value={formatNumber(data.studentCount)} sub="Across your assigned classes" />
            <StatCard
              label="Tests created"
              value={formatNumber(Object.values(data.tests || {}).reduce((s, v) => s + v, 0))}
            />
          </div>

          {Object.keys(data.tests || {}).length > 0 && (
            <Panel title="Tests by status">
              <div className="flex flex-wrap gap-3">
                {Object.entries(data.tests).map(([status, count]) => (
                  <span
                    key={status}
                    className="rounded-md border border-ink-200 px-3 py-1.5 text-xs text-ink-700 capitalize"
                  >
                    {status}: <span className="font-tabular font-medium">{formatNumber(count)}</span>
                  </span>
                ))}
              </div>
            </Panel>
          )}

          {data.studentCount === 0 && (
            <div className="rounded-lg border border-dashed border-ink-300 bg-paper-50 px-5 py-8 text-center text-sm text-ink-500">
              You don't have any class assignments yet. Once your admin assigns you to a class, your students
              will appear here.
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
