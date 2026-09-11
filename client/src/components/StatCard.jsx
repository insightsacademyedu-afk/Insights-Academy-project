export default function StatCard({ label, value, sub, tone = "ink" }) {
  const toneClasses = {
    ink: "text-ink-950",
    brass: "text-brass-600",
    moss: "text-moss-600",
    brick: "text-brick-600",
  };

  return (
    <div className="rounded-lg border border-ink-200 bg-paper-50 px-5 py-4">
      <div className="text-xs font-medium text-ink-500 tracking-wide">{label}</div>
      <div className={`font-tabular text-2xl md:text-3xl mt-1.5 ${toneClasses[tone]}`}>{value}</div>
      {sub && <div className="text-xs text-ink-500 mt-1">{sub}</div>}
    </div>
  );
}
