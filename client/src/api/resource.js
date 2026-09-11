import api from "./client";

// Mirrors server/utils/crudFactory.js — one thin wrapper per resource
// instead of hand-writing the same five calls repeatedly.
export function createResourceApi(basePath) {
  return {
    async list(params = {}) {
      const first = (await api.get(basePath, { params })).data;
      // Dropdown lookups request large lists without a page; the API caps each page at 100.
      if (params.page === undefined && Number(params.limit) >= 100 && first.totalPages > 1) {
        const items = [...first.items];
        for (let page = 2; page <= first.totalPages; page += 1) {
          const next = (await api.get(basePath, { params: { ...params, page } })).data;
          items.push(...next.items);
        }
        return { ...first, items };
      }
      return first;
    },
    getOne(id) {
      return api.get(`${basePath}/${id}`).then((r) => r.data);
    },
    create(body) {
      return api.post(basePath, body).then((r) => r.data);
    },
    update(id, body) {
      return api.put(`${basePath}/${id}`, body).then((r) => r.data);
    },
    remove(id, credentials) {
      return api.delete(`${basePath}/${id}`, { data: credentials }).then((r) => r.data);
    },
  };
}
