import { buildListQuery, paginatedResponse } from "./listQuery.js";

// Generic CRUD factory for straightforward "reference data" collections
// (academic sessions, classes, sections, subjects, designations...).
// Anything with more complex rules (students, fees, results) gets its own
// dedicated controller instead of using this — don't stretch this to fit
// everything, it's specifically for simple admin-managed lookup tables.
//
// options:
//   searchFields   - fields eligible for ?search=
//   exactFilters   - fields eligible for exact-match query params (?status=active)
//   populate       - mongoose populate path(s) applied to list/get
//   beforeDelete   - async (doc) => { throw new Error(...) } to block deletes
//                    that would orphan references (e.g. a Class with Sections)
//   duplicateMessage - friendly message when a unique-index write collides

export function createCrudController(Model, options = {}) {
  const {
    searchFields = [],
    exactFilters = ["status"],
    populate = null,
    beforeDelete = null,
    duplicateMessage = "A record with these values already exists",
  } = options;

  async function list(req, res, next) {
    try {
      const { filter, page, limit, skip, sort } = buildListQuery(req.query, {
        searchFields,
        exactFilters,
      });
      filter.archivedAt = null;

      let query = Model.find(filter).sort(sort).skip(skip).limit(limit);
      if (populate) query = query.populate(populate);

      const [items, total] = await Promise.all([query.exec(), Model.countDocuments(filter)]);

      res.json(paginatedResponse(items, total, page, limit));
    } catch (err) {
      next(err);
    }
  }

  async function getOne(req, res, next) {
    try {
      let query = Model.findOne({ _id: req.params.id, archivedAt: null });
      if (populate) query = query.populate(populate);
      const doc = await query.exec();

      if (!doc) return res.status(404).json({ message: "Not found" });
      res.json(doc);
    } catch (err) {
      next(err);
    }
  }

  async function create(req, res, next) {
    try {
      const { _id, __v, createdAt, updatedAt, ...fields } = req.body;
      let doc;
      await Model.db.transaction(async session => { [doc] = await Model.create([fields], { session }); });
      res.status(201).json(doc);
    } catch (err) {
      handleWriteError(err, res, next, duplicateMessage);
    }
  }

  async function update(req, res, next) {
    try {
      let doc;
      await Model.db.transaction(async session => {
        doc = await Model.findOne({ _id: req.params.id, archivedAt: null }).session(session);
        if (!doc) return;
        const { _id, __v, createdAt, updatedAt, ...fields } = req.body;
        doc.set(fields);
        await doc.save({ session });
      });
      if (!doc) return res.status(404).json({ message: "Not found" });
      res.json(doc);
    } catch (err) {
      handleWriteError(err, res, next, duplicateMessage);
    }
  }

  async function remove(req, res, next) {
    try {
      const doc = await Model.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: "Not found" });

      if (beforeDelete) {
        await beforeDelete(doc); // throws to block the delete
      }

      await doc.deleteOne();
      res.json({ message: "Deleted" });
    } catch (err) {
      if (err.blocksDelete) {
        return res.status(409).json({ message: err.message });
      }
      next(err);
    }
  }

  return { list, getOne, create, update, remove };
}

function handleWriteError(err, res, next, duplicateMessage) {
  if (err.name === "ValidationError") {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: duplicateMessage });
  }
  next(err);
}

// Small helper for beforeDelete hooks to signal a 409 rather than a 500
export function blockDelete(message) {
  const err = new Error(message);
  err.blocksDelete = true;
  throw err;
}
