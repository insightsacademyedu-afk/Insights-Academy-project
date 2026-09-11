import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useResourceList } from "./useResourceList";

function makeApi(items = [], total = 0, totalPages = 1) {
  return {
    list: vi.fn().mockResolvedValue({ items, total, totalPages }),
  };
}

describe("useResourceList", () => {
  it("ignores a stale response that arrives after the latest search", async () => {
    const pending=[];
    const api={list:vi.fn(()=>new Promise(resolve=>pending.push(resolve)))};
    const {result}=renderHook(()=>useResourceList(api));
    act(()=>result.current.setSearch('new'));
    await waitFor(()=>expect(pending.length).toBe(2));
    await act(async()=>pending[1]({items:[{_id:'new'}],total:1,totalPages:1}));
    await act(async()=>pending[0]({items:[{_id:'old'}],total:1,totalPages:1}));
    expect(result.current.items).toEqual([{_id:'new'}]);
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads on mount and exposes the paginated shape", async () => {
    const api = makeApi([{ _id: "1" }], 1, 1);
    const { result } = renderHook(() => useResourceList(api));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toEqual([{ _id: "1" }]);
    expect(result.current.total).toBe(1);
    expect(api.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, search: "", status: "" })
    );
  });

  it("resets to page 1 when the search term changes", async () => {
    const api = makeApi([], 0, 1);
    const { result } = renderHook(() => useResourceList(api));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.page).toBe(3));

    act(() => result.current.setSearch("john"));
    await waitFor(() => expect(result.current.page).toBe(1));
  });

  it("passes extraParams through to every list() call and re-fetches when they change", async () => {
    const api = makeApi([], 0, 1);
    const { rerender } = renderHook(({ extra }) => useResourceList(api, extra), {
      initialProps: { extra: { status: "active", scope: "a" } },
    });

    await waitFor(() =>
      expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ scope: "a" }))
    );

    rerender({ extra: { status: "active", scope: "b" } });

    await waitFor(() =>
      expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ scope: "b" }))
    );
  });

  it("surfaces a rejected list() call as `error`, not an unhandled rejection", async () => {
    const api = { list: vi.fn().mockRejectedValue(new Error("network down")) };
    const { result } = renderHook(() => useResourceList(api));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.items).toEqual([]);
  });
});
