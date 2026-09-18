import api from "./client";

// Every report route returns a plain `{items, ...totals}` shape (not the
// generic paginated `{items,page,totalPages,...}` shape `useResourceList`
// expects) — confirmed by re-reading `reportController.js` directly: none
// of the four handlers call `buildListQuery`'s `skip`/`limit`, they return
// every matching row in one response. Fine at small-school data volumes
// (same reasoning already used elsewhere in this app, e.g. the "Specific
// staff pickers elsewhere), but it does mean this module
// is plain `api.get()` calls rather than a `createResourceApi`/
// `useResourceList` pairing, same as `api/dashboard.js`.

export function fetchStudentsReport(params = {}) {
  return api.get("/reports/students", { params }).then((r) => r.data);
}

export function fetchFeeCollectionReport(params = {}) {
  return api.get("/reports/fee-collection", { params }).then((r) => r.data);
}

export function fetchOutstandingFeesReport() {
  return api.get("/reports/outstanding-fees").then((r) => r.data);
}

export function fetchExpensesReport(params = {}) {
  return api.get("/reports/expenses", { params }).then((r) => r.data);
}

// Shared CSV-download helper. Every report route streams a real CSV file
// with `Content-Disposition: attachment` when `?format=csv` is added (see
// `sendCsv()` in `reportController.js`) — there's no separate download
// endpoint, so this just re-requests the same path with `responseType:
// "blob"` and drives the browser's own download flow from the result.
export async function downloadReportCsv(path, params, filename) {
  const res = await api.get(path, {
    params: { ...params, format: "csv" },
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
