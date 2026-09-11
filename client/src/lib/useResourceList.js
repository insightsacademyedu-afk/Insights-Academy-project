import { useCallback, useEffect, useState, useRef } from "react";

export function useResourceList(resourceApi, extraParams = {}) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const requestId = useRef(0);
  const extraKey = JSON.stringify(extraParams);

  const load = useCallback(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    resourceApi
      .list({ page, search, status, ...JSON.parse(extraKey) })
      .then((res) => {
        if (id !== requestId.current) return;
        setItems(res.items);
        setTotalPages(res.totalPages);
        setTotal(res.total);
      })
      .catch((err) => { if (id === requestId.current) setError(err); })
      .finally(() => { if (id === requestId.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceApi, page, search, status, extraKey]);

  useEffect(() => {
    load();
    return () => { requestId.current += 1; };
  }, [load]);

  // Reset to page 1 whenever the search/status/scope changes.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, extraKey]);

  return {
    items,
    page,
    setPage,
    totalPages,
    total,
    search,
    setSearch,
    status,
    setStatus,
    loading,
    error,
    refetch: load,
  };
}
