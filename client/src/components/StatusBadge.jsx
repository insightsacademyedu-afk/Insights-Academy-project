const TONES = {
  active: "bg-moss-100 text-moss-600",
  paid: "bg-moss-100 text-moss-600",
  completed: "bg-moss-100 text-moss-600",
  inactive: "bg-ink-100 text-ink-600",
  archived: "bg-ink-100 text-ink-600",
  pending: "bg-amber-100 text-amber-600",
  queued: "bg-amber-100 text-amber-600",
  processing: "bg-amber-100 text-amber-600",
  overdue: "bg-brick-100 text-brick-600",
  failed: "bg-brick-100 text-brick-600",
  unpaid: "bg-brick-100 text-brick-600",
  partially_paid: "bg-amber-100 text-amber-600",
  waived: "bg-ink-100 text-ink-600",
  draft: "bg-amber-100 text-amber-600",
  finalized: "bg-moss-100 text-moss-600",
  sent: "bg-moss-100 text-moss-600",
  delivered: "bg-moss-100 text-moss-600",
};

export default function StatusBadge({ status }) {
  const tone = TONES[status] || "bg-ink-100 text-ink-600";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${tone}`}>
      {String(status).replace(/_/g, " ")}
    </span>
  );
}
