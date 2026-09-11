// Shared list-query helper so pagination/search/filter logic lives in one
// place instead of being reimplemented per module (spec explicitly calls
// out avoiding duplicated code for this).
//
// Usage in a controller:
//   const { filter, page, limit, skip, sort } = buildListQuery(req.query, {
//     searchFields: ["name", "code"],
//   });
//   const [items, total] = await Promise.all([
//     Model.find(filter).sort(sort).skip(skip).limit(limit),
//     Model.countDocuments(filter),
//   ]);
//   res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export function buildListQuery(query, { searchFields = [], exactFilters = [] } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;

  const filter = {};

  // Free-text search across the given fields (case-insensitive partial match)
  if (query.search && searchFields.length > 0) {
    const safe = String(query.search).trim();
    if (safe) {
      // Escape regex special characters so user input can't break the pattern
      const escaped = safe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = searchFields.map((field) => ({
        [field]: { $regex: escaped, $options: "i" },
      }));
    }
  }

  // Exact-match filters, e.g. ?status=active
  for (const field of exactFilters) {
    if (query[field] !== undefined && query[field] !== "") {
      filter[field] = query[field];
    }
  }

  let sort = { createdAt: -1 };
  if (query.sortBy) {
    const direction = query.sortDir === "asc" ? 1 : -1;
    sort = { [query.sortBy]: direction };
  }

  return { filter, page, limit, skip, sort };
}

export function paginatedResponse(items, total, page, limit) {
  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
