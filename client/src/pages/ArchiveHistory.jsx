import { useCallback, useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import Button from "../components/Button";
import ConfirmDialog from "../components/ConfirmDialog";
import Pagination from "../components/Pagination";
import { listArchive, restoreArchive } from "../api/archive";
import { formatDate } from "../lib/format";

export default function ArchiveHistory() {
  const [data, setData] = useState({ items: [], page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [state, setState] = useState("archived");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [target, setTarget] = useState(null);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await listArchive({ page, limit: 20, state })); }
    catch (err) { setError(err.message || "Could not load archive history"); }
    finally { setLoading(false); }
  }, [page, state]);
  useEffect(() => { load(); }, [load]);

  async function restore(credentials) {
    setRestoring(true);
    try { await restoreArchive(target._id, credentials); setTarget(null); await load(); }
    catch (err) { setError(err.message || "Could not restore archive"); }
    finally { setRestoring(false); }
  }

  return <AppLayout title="Archive history">
    <div className="mb-4 flex items-center justify-between gap-3">
      <p className="text-sm text-ink-600">Archived records are hidden from normal work but retained for audit and recovery.</p>
      <select aria-label="Archive state" value={state} onChange={event => { setState(event.target.value); setPage(1); }}
        className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm">
        <option value="archived">Currently archived</option>
        <option value="restored">Restored history</option>
      </select>
    </div>
    {error && <p role="alert" className="mb-4 text-sm text-brick-600">{error}</p>}
    {loading ? <p role="status">Loading archive…</p> : data.items.length === 0 ?
      <p className="rounded-md border border-ink-100 bg-white p-6 text-sm text-ink-500">No records in this view.</p> :
      <div className="overflow-x-auto rounded-md border border-ink-100 bg-white"><table className="w-full text-sm">
        <thead><tr className="border-b bg-paper-100 text-left"><th className="p-3">Record</th><th className="p-3">Type</th><th className="p-3">Reason</th><th className="p-3">Archived</th><th className="p-3">Impact</th><th className="p-3"></th></tr></thead>
        <tbody>{data.items.map(item => <tr key={item._id} className="border-b last:border-0">
          <td className="p-3 font-medium">{item.label}</td><td className="p-3">{item.resourceType}</td>
          <td className="p-3">{item.reason}</td><td className="p-3">{formatDate(item.archivedAt)} by {item.archivedBy?.username || "admin"}</td>
          <td className="p-3">{item.changes?.length || 1} record(s)</td>
          <td className="p-3">{item.state === "archived" && <Button variant="ghost" onClick={() => setTarget(item)}>Restore</Button>}</td>
        </tr>)}</tbody>
      </table></div>}
    <Pagination page={data.page || page} totalPages={data.totalPages || 1} total={data.total || 0} onChange={setPage} />
    <ConfirmDialog open={!!target} onClose={() => setTarget(null)} onConfirm={restore} busy={restoring}
      title={`Restore ${target?.label || "record"}`} confirmLabel="Restore"
      message="Restore this record and the related records archived in the same operation?" />
  </AppLayout>;
}
