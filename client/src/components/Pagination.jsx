import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ page, totalPages, total, onChange }) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between mt-3 text-sm text-ink-600">
      <span>{total} total</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-ink-200 p-1.5 disabled:opacity-40 hover:border-ink-300"
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="font-tabular text-xs">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-md border border-ink-200 p-1.5 disabled:opacity-40 hover:border-ink-300"
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
