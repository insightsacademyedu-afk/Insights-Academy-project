export default function DataTable({ columns, rows, loading, emptyMessage = "Nothing here yet.", rowKey = "_id" }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-ink-200 bg-paper-50">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-200 bg-ink-100/60">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-2.5 text-left text-[11px] font-medium text-ink-600 tracking-wide ${col.headClassName || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-ink-100 last:border-0">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <div className="h-3.5 w-3/4 rounded bg-ink-100 animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}

          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-ink-500">
                {emptyMessage}
              </td>
            </tr>
          )}

          {!loading &&
            rows.map((row) => (
              <tr key={row[rowKey]} className="border-b border-ink-100 last:border-0 hover:bg-paper-100/70">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 align-middle ${col.cellClassName || ""}`}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
