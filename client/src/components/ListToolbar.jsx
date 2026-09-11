import { Search, Plus } from "lucide-react";

export default function ListToolbar({ search, onSearchChange, searchPlaceholder = "Search…", status, onStatusChange, statusOptions = ["active", "inactive"], onCreate, createLabel = "New" }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
      <div className="relative flex-1 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-md border border-ink-200 bg-white pl-9 pr-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-700/10"
        />
      </div>

      {onStatusChange && (
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none focus:border-ink-700"
        >
          <option value="">All statuses</option>
          {statusOptions.map(value => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}
        </select>
      )}

      <div className="flex-1" />

      {onCreate && (
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-brass-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-brass-600"
        >
          <Plus size={15} />
          {createLabel}
        </button>
      )}
    </div>
  );
}
