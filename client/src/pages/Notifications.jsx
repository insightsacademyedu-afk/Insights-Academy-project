import { useEffect, useState } from "react";
import { Plus, RotateCw, Eye, Bell } from "lucide-react";
import AppLayout from "../components/AppLayout";
import DataTable from "../components/DataTable";
import Pagination from "../components/Pagination";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import Button from "../components/Button";
import { Field, TextInput, TextArea, Select } from "../components/FormFields";
import { notificationsApi } from "../api/notifications";
import { academicSessionsApi, classesApi, sectionsApi } from "../api/academicSetup";
import { staffApi } from "../api/staff";
import { useResourceList } from "../lib/useResourceList";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { formatDate } from "../lib/format";

export default function Notifications() {
  const { isAdmin } = useAuth();
  return (
    <AppLayout title="Notifications">
      {isAdmin ? <AdminNotifications /> : <MyNotifications />}
    </AppLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Admin — send announcements, browse delivery history
// ─────────────────────────────────────────────────────────────────────────

const NOTIFICATION_STATUSES = ["queued", "processing", "completed", "failed"];
const CHANNELS = [
  { key: "in_app", label: "In-app" },
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "whatsapp", label: "WhatsApp" },
];

function AdminNotifications() {
  const toast = useToast();
  // notificationsApi.list already returns the generic {items,...} shape
  // and supports search (title) + an exact status filter, so
  // useResourceList's own search/status state works directly here — no
  // extraParams object needed. The toolbar below is still custom (not
  // the shared ListToolbar) because ListToolbar's status dropdown is
  // hardcoded to active/inactive, and Notification's real enum is
  // queued/processing/completed/failed — same reasoning Fees.jsx/
  // Students.jsx/Tests.jsx used for their own custom toolbars.
  const list = useResourceList(notificationsApi);

  const [newOpen, setNewOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [retrying, setRetrying] = useState(false);

  async function handleRetryFailed() {
    setRetrying(true);
    try {
      const res = await notificationsApi.retryFailed();
      toast.success(
        res.retriedCount > 0
          ? `Retried ${res.retriedCount} failed deliver${res.retriedCount === 1 ? "y" : "ies"}`
          : "No failed deliveries were eligible for retry right now"
      );
      list.refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRetrying(false);
    }
  }

  const columns = [
    {
      key: "title",
      header: "Notification",
      render: (row) => (
        <div>
          <div className="font-medium text-ink-900">{row.title}</div>
          <div className="text-xs text-ink-500">{row.audienceDescription || "No audience note"}</div>
        </div>
      ),
    },
    {
      key: "channels",
      header: "Channels",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.channels.map((c) => (
            <span key={c} className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-700">
              {CHANNELS.find((ch) => ch.key === c)?.label || c}
            </span>
          ))}
        </div>
      ),
    },
    { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "createdAt", header: "Sent", render: (row) => formatDate(row.createdAt) },
    {
      key: "actions",
      header: "",
      headClassName: "w-16",
      render: (row) => (
        <div className="flex justify-end">
          <button
            onClick={() => setDetailId(row._id)}
            className="p-1.5 text-ink-500 hover:text-ink-900"
            aria-label="View delivery detail"
            title="View delivery detail"
          >
            <Eye size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <input
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value)}
            placeholder="Search by title…"
            className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-700/10"
          />
        </div>

        <select
          value={list.status}
          onChange={(e) => list.setStatus(e.target.value)}
          className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-700"
        >
          <option value="">All statuses</option>
          {NOTIFICATION_STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s}
            </option>
          ))}
        </select>

        <div className="flex-1" />

        <Button variant="ghost" onClick={handleRetryFailed} disabled={retrying}>
          <RotateCw size={15} />
          {retrying ? "Retrying…" : "Retry failed"}
        </Button>
        <Button onClick={() => setNewOpen(true)}>
          <Plus size={15} />
          New notification
        </Button>
      </div>

      {list.error && (
        <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-4 py-3 text-sm text-brick-600">
          Couldn't load notifications: {list.error.message}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={list.items}
        loading={list.loading}
        emptyMessage="No notifications sent yet."
      />
      <Pagination page={list.page} totalPages={list.totalPages} total={list.total} onChange={list.setPage} />

      <NewNotificationModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSaved={() => {
          setNewOpen(false);
          list.refetch();
        }}
      />

      <NotificationDetailModal notificationId={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}

const AUDIENCE_TYPES = [
  { key: "class_section", label: "Class & section guardians" },
  { key: "all_guardians", label: "All guardians" },
  { key: "staff", label: "Specific staff" },
  { key: "all_staff", label: "All staff" },
];

const EMPTY_NEW_FORM = {
  title: "",
  body: "",
  channels: ["in_app"],
  audienceDescription: "",
  audienceType: "class_section",
  academicSession: "",
  class: "",
  section: "",
  staffIds: [],
};

function NewNotificationModal({ open, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_NEW_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [classesForSession, setClassesForSession] = useState([]);
  const [sectionsForClass, setSectionsForClass] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_NEW_FORM);
    setError("");
    academicSessionsApi
      .list({ limit: 100, sortBy: "startDate", sortDir: "desc" })
      .then((res) => setSessions(res.items))
      .catch(() => {});
    staffApi
      .list({ limit: 300, status: "active" })
      .then((res) => setStaffOptions(res.items))
      .catch(() => {});
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

  function toggleChannel(key) {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(key) ? f.channels.filter((c) => c !== key) : [...f.channels, key],
    }));
  }

  function toggleStaff(id) {
    setForm((f) => ({
      ...f,
      staffIds: f.staffIds.includes(id) ? f.staffIds.filter((s) => s !== id) : [...f.staffIds, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.channels.length === 0) {
      setError("Pick at least one channel");
      return;
    }
    if (form.audienceType === "class_section" && (!form.academicSession || !form.class || !form.section)) {
      setError("Pick a session, class and section for this audience");
      return;
    }
    if (form.audienceType === "staff" && form.staffIds.length === 0) {
      setError("Pick at least one staff member");
      return;
    }

    let audience;
    if (form.audienceType === "class_section") {
      audience = {
        type: "class_section",
        academicSession: form.academicSession,
        classId: form.class,
        sectionId: form.section,
      };
    } else if (form.audienceType === "staff") {
      audience = { type: "staff", staffIds: form.staffIds };
    } else {
      audience = { type: form.audienceType };
    }

    setSaving(true);
    setError("");
    try {
      const res = await notificationsApi.create({
        title: form.title,
        body: form.body,
        channels: form.channels,
        audienceDescription: form.audienceDescription,
        audience,
      });
      toast.success(`Sent to ${res.recipientCount} recipient${res.recipientCount === 1 ? "" : "s"}`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New notification" width="max-w-lg">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
            {error}
          </div>
        )}

        <Field label="Title" required>
          <TextInput required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>

        <Field label="Message" required>
          <TextArea
            required
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </Field>

        <Field label="Channels" required>
          <div className="flex flex-wrap gap-3">
            {CHANNELS.map((c) => (
              <label key={c.key} className="flex items-center gap-1.5 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={form.channels.includes(c.key)}
                  onChange={() => toggleChannel(c.key)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </Field>
        {(form.channels.includes("sms") || form.channels.includes("whatsapp")) && (
          <p className="-mt-2.5 mb-4 text-xs text-amber-600">
            SMS and WhatsApp have no free-tier provider configured yet — recipients missing that channel's
            contact info are skipped, and sends will show as failed until a provider is wired up.
          </p>
        )}

        <Field label="Audience" required>
          <Select
            value={form.audienceType}
            onChange={(e) => setForm({ ...form, audienceType: e.target.value, academicSession: "", class: "", section: "", staffIds: [] })}
          >
            {AUDIENCE_TYPES.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>

        {form.audienceType === "class_section" && (
          <div className="mb-4 rounded-md border border-ink-100 bg-paper-100/60 p-3">
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
            <p className="mb-0 text-xs text-ink-500">
              Reaches the guardian of every student actively enrolled in this class/section right now.
            </p>
          </div>
        )}

        {form.audienceType === "staff" && (
          <Field label="Staff members" required>
            <div className="max-h-40 overflow-y-auto rounded-md border border-ink-200 bg-white p-2">
              {staffOptions.length === 0 && <p className="px-1 py-1 text-xs text-ink-500">No active staff found.</p>}
              {staffOptions.map((s) => (
                <label key={s._id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-paper-100">
                  <input
                    type="checkbox"
                    checked={form.staffIds.includes(s._id)}
                    onChange={() => toggleStaff(s._id)}
                  />
                  {s.fullName}
                </label>
              ))}
            </div>
          </Field>
        )}

        {form.audienceType === "all_guardians" && (
          <p className="mb-4 text-xs text-ink-500">Reaches every guardian on file, school-wide.</p>
        )}
        {form.audienceType === "all_staff" && (
          <p className="mb-4 text-xs text-ink-500">Reaches every active staff member, school-wide.</p>
        )}

        <Field label="Audience note (optional)">
          <TextInput
            placeholder="e.g. Class 10 - Section A guardians"
            value={form.audienceDescription}
            onChange={(e) => setForm({ ...form, audienceDescription: e.target.value })}
          />
        </Field>
        <p className="-mt-2.5 mb-4 text-xs text-ink-500">
          Just for your own reference in the list below — recipients are resolved and locked in the moment
          you send, so a later change to class rosters won't retroactively change who received this.
        </p>

        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function NotificationDetailModal({ notificationId, onClose }) {
  const toast = useToast();
  const [data, setData] = useState(null); // {notification, recipients, deliverySummary}
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!notificationId) {
      setData(null);
      return;
    }
    setLoading(true);
    notificationsApi
      .getOne(notificationId)
      .then(setData)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationId]);

  const notification = data?.notification;
  const summary = data?.deliverySummary || {};
  const summaryStatuses = ["pending", "sent", "delivered", "failed"];

  return (
    <Modal
      open={!!notificationId}
      onClose={onClose}
      title={notification ? notification.title : "Notification"}
      width="max-w-2xl"
    >
      {loading && <p className="text-sm text-ink-500">Loading…</p>}

      {notification && (
        <div>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-ink-700">{notification.body}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {notification.channels.map((c) => (
                  <span key={c} className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-700">
                    {CHANNELS.find((ch) => ch.key === c)?.label || c}
                  </span>
                ))}
              </div>
              {notification.audienceDescription && (
                <p className="mt-1.5 text-xs text-ink-500">{notification.audienceDescription}</p>
              )}
              <p className="mt-1 text-xs text-ink-500">Sent {formatDate(notification.createdAt)}</p>
            </div>
            <StatusBadge status={notification.status} />
          </div>

          <div className="mb-4 grid grid-cols-4 gap-2">
            {summaryStatuses.map((s) => (
              <div key={s} className="rounded-md border border-ink-100 bg-paper-100/60 px-2 py-2.5 text-center">
                <div className="font-tabular text-lg text-ink-950">{summary[s] || 0}</div>
                <div className="text-[11px] capitalize text-ink-500">{s}</div>
              </div>
            ))}
          </div>

          <h3 className="mb-2 text-xs font-medium tracking-wide text-ink-600">RECIPIENTS</h3>
          {data.recipients.length === 0 ? (
            <p className="text-sm text-ink-500">No recipients were resolved for this notification.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto overflow-x-auto rounded-md border border-ink-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="border-b border-ink-100 bg-ink-100/60 text-left text-ink-600">
                    <th className="px-3 py-1.5 font-medium">Type</th>
                    <th className="px-3 py-1.5 font-medium">Channel</th>
                    <th className="px-3 py-1.5 font-medium">Destination</th>
                    <th className="px-3 py-1.5 font-medium">Status</th>
                    <th className="px-3 py-1.5 text-right font-medium">Attempts</th>
                    <th className="px-3 py-1.5 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recipients.map((r) => (
                    <tr key={r._id} className="border-b border-ink-100 last:border-0">
                      <td className="px-3 py-1.5 capitalize">{r.recipientType}</td>
                      <td className="px-3 py-1.5">{CHANNELS.find((c) => c.key === r.channel)?.label || r.channel}</td>
                      <td className="px-3 py-1.5">{r.destination}</td>
                      <td className="px-3 py-1.5">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-3 py-1.5 text-right font-tabular">{r.attempts}</td>
                      <td className="px-3 py-1.5 text-brick-600">{r.lastError || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Non-admin — a plain read-only feed of the logged-in user's own in-app
// notifications
// ─────────────────────────────────────────────────────────────────────────

function MyNotifications() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notificationsApi
      .mine()
      .then((res) => setItems(res.items))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <p className="text-sm text-ink-500">Loading…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-ink-200 bg-paper-50 px-5 py-10 text-center text-sm text-ink-500">
        <Bell size={22} className="mx-auto mb-2 text-ink-300" />
        No notifications yet.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((row) => (
        <div key={row._id} className="rounded-lg border border-ink-200 bg-paper-50 px-4 py-3.5">
          <div className="mb-1 flex items-start justify-between gap-3">
            <h3 className="font-display text-sm text-ink-950">{row.notification?.title}</h3>
            <StatusBadge status={row.status} />
          </div>
          <p className="text-sm text-ink-700">{row.notification?.body}</p>
          <p className="mt-1.5 text-xs text-ink-500">{formatDate(row.sentAt || row.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}
