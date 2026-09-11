import mongoose from "mongoose";
import User from "../models/User.js";
import AcademicSession from "../models/AcademicSession.js";
import Class from "../models/Class.js";
import Section from "../models/Section.js";
import Subject from "../models/Subject.js";
import Designation from "../models/Designation.js";
import Staff from "../models/Staff.js";
import Student from "../models/Student.js";
import StudentClassAssignment from "../models/StudentClassAssignment.js";
import TeacherClassAssignment from "../models/TeacherClassAssignment.js";
import Test from "../models/Test.js";
import TestResult from "../models/TestResult.js";
import ExpenseCategory from "../models/ExpenseCategory.js";
import Expense from "../models/Expense.js";
import ArchiveEntry from "../models/ArchiveEntry.js";
import { buildListQuery, paginatedResponse } from "../utils/listQuery.js";

const MODELS = {
  academicSession: AcademicSession,
  class: Class,
  section: Section,
  subject: Subject,
  designation: Designation,
  staff: Staff,
  student: Student,
  teacherAssignment: TeacherClassAssignment,
  expenseCategory: ExpenseCategory,
  expense: Expense,
};

const ALL_MODELS = [
  ...Object.values(MODELS), StudentClassAssignment, Test, TestResult, User,
];

// Archive metadata is deliberately independent of each model's business status.
// Existing documents need no migration; `{ archivedAt: null }` also matches a missing field.
for (const Model of ALL_MODELS) {
  Model.schema.add({
    archivedAt: { type: Date, default: null, index: true },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    archiveReason: { type: String, default: "" },
    archiveBatchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  });
}

const labelFor = (type, doc) => ({
  academicSession: doc.name,
  class: doc.name,
  section: doc.name,
  subject: `${doc.name}${doc.code ? ` (${doc.code})` : ""}`,
  designation: doc.title,
  staff: doc.fullName,
  student: `${doc.fullName}${doc.admissionNumber ? ` (${doc.admissionNumber})` : ""}`,
  teacherAssignment: `Teacher assignment ${doc._id}`,
  expenseCategory: doc.name,
  expense: doc.description || `Expense ${doc._id}`,
}[type] || `${type} ${doc._id}`);

async function verifyPassword(req) {
  const password = req.body?.adminPassword;
  if (typeof password !== "string" || !password || Buffer.byteLength(password, "utf8") > 72) {
    throw Object.assign(new Error("Current admin password is required"), { status: 400 });
  }
  const admin = await User.findOne({ _id: req.user._id, role: "admin", status: "active" }).select("+passwordHash");
  if (!admin || !(await admin.comparePassword(password))) {
    throw Object.assign(new Error("Current admin password is incorrect"), { status: 403 });
  }
}

function ids(docs) { return docs.map((doc) => doc._id); }

async function buildChanges(type, root, session) {
  const changes = [];
  const seen = new Set();
  async function add(Model, filter) {
    const docs = await Model.collection.find({ ...filter, archivedAt: null }, { session, projection: { _id: 1, status: 1 } }).toArray();
    for (const doc of docs) {
      const key = `${Model.modelName}:${doc._id}`;
      if (!seen.has(key)) {
        seen.add(key);
        changes.push({ model: Model.modelName, documentId: doc._id, previousStatus: doc.status ?? null });
      }
    }
    return docs;
  }

  await add(MODELS[type], { _id: root._id });

  let classDocs = [], sectionDocs = [], testDocs = [];
  if (type === "academicSession") {
    classDocs = await add(Class, { academicSession: root._id });
    sectionDocs = await add(Section, { class: { $in: ids(classDocs) } });
    await add(StudentClassAssignment, { $or: [{ academicSession: root._id }, { class: { $in: ids(classDocs) } }, { section: { $in: ids(sectionDocs) } }] });
    await add(TeacherClassAssignment, { $or: [{ academicSession: root._id }, { class: { $in: ids(classDocs) } }, { section: { $in: ids(sectionDocs) } }] });
    testDocs = await add(Test, { $or: [{ academicSession: root._id }, { class: { $in: ids(classDocs) } }, { section: { $in: ids(sectionDocs) } }] });
  } else if (type === "class") {
    sectionDocs = await add(Section, { class: root._id });
    await add(StudentClassAssignment, { $or: [{ class: root._id }, { section: { $in: ids(sectionDocs) } }] });
    await add(TeacherClassAssignment, { $or: [{ class: root._id }, { section: { $in: ids(sectionDocs) } }] });
    testDocs = await add(Test, { $or: [{ class: root._id }, { section: { $in: ids(sectionDocs) } }] });
  } else if (type === "section") {
    await add(StudentClassAssignment, { section: root._id });
    await add(TeacherClassAssignment, { section: root._id });
    testDocs = await add(Test, { section: root._id });
  } else if (type === "subject") {
    await add(TeacherClassAssignment, { subject: root._id });
    testDocs = await add(Test, { subject: root._id });
  } else if (type === "staff") {
    await add(TeacherClassAssignment, { teacher: root._id });
    const userLinks = [{ staffId: root._id }];
    if (root.user) userLinks.push({ _id: root.user });
    await add(User, { $or: userLinks });
  } else if (type === "student") {
    await add(StudentClassAssignment, { student: root._id });
  }
  if (testDocs.length) await add(TestResult, { test: { $in: ids(testDocs) } });
  return changes;
}

export function archiveResource(type) {
  const Model = MODELS[type];
  if (!Model) throw new Error(`Unsupported archive resource: ${type}`);
  return async (req, res, next) => {
    try {
      await verifyPassword(req);
      const reason = typeof req.body.reason === "string" ? req.body.reason.trim() : "";
      if (reason.length < 3 || reason.length > 500) return res.status(400).json({ message: "Archive reason must be 3 to 500 characters" });
      if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid record id" });
      let entry;
      await mongoose.connection.transaction(async (session) => {
        const root = await Model.collection.findOne({ _id: new mongoose.Types.ObjectId(req.params.id), archivedAt: null }, { session });
        if (!root) throw Object.assign(new Error("Record not found or already archived"), { status: 404 });
        if (type === "expense" && root.sourceSalaryPayment) {
          throw Object.assign(new Error("A salary-generated expense must remain linked to its paid salary and cannot be archived separately"), { status: 409 });
        }
        const changes = await buildChanges(type, root, session);
        const batchId = new mongoose.Types.ObjectId();
        const now = new Date();
        for (const change of changes) {
          const ChangedModel = mongoose.model(change.model);
          const update = { $set: { archivedAt: now, archivedBy: req.user._id, archiveReason: reason, archiveBatchId: batchId } };
          if (change.model === "AcademicSession") update.$set.isCurrent = false;
          if (change.model === "User") {
            update.$set.status = "inactive";
            update.$inc = { tokenVersion: 1 };
          }
          await ChangedModel.collection.updateOne({ _id: change.documentId, archivedAt: null }, update, { session });
        }
        [entry] = await ArchiveEntry.create([{
          _id: batchId, resourceType: type, resourceId: root._id, label: labelFor(type, root), reason,
          archivedBy: req.user._id, archivedAt: now, changes,
        }], { session });
      });
      res.json({ message: "Archived", archive: entry });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ message: error.message });
      next(error);
    }
  };
}

export async function listArchive(req, res, next) {
  try {
    const { filter, page, limit, skip, sort } = buildListQuery(req.query, {
      searchFields: ["label", "reason", "resourceType"], exactFilters: ["state", "resourceType"],
    });
    const [items, total] = await Promise.all([
      ArchiveEntry.find(filter).populate("archivedBy restoredBy", "username").sort(sort).skip(skip).limit(limit),
      ArchiveEntry.countDocuments(filter),
    ]);
    res.json(paginatedResponse(items, total, page, limit));
  } catch (error) { next(error); }
}

export async function restoreArchive(req, res, next) {
  try {
    await verifyPassword(req);
    const restoreReason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (restoreReason.length < 3 || restoreReason.length > 500) return res.status(400).json({ message: "Restore reason must be 3 to 500 characters" });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid archive id" });
    let restoredCount = 0;
    await mongoose.connection.transaction(async (session) => {
      const entry = await ArchiveEntry.findOne({ _id: req.params.id, state: "archived" }).session(session);
      if (!entry) throw Object.assign(new Error("Active archive entry not found"), { status: 404 });
      for (const change of entry.changes) {
        const Model = mongoose.model(change.model);
        const update = { $set: { archivedAt: null, archivedBy: null, archiveReason: "", archiveBatchId: null } };
        if (change.previousStatus !== null) update.$set.status = change.previousStatus;
        if (change.model === "User") update.$inc = { tokenVersion: 1 };
        const result = await Model.collection.updateOne({ _id: change.documentId, archiveBatchId: entry._id }, update, { session });
        restoredCount += result.modifiedCount;
      }
      entry.state = "restored";
      entry.restoredBy = req.user._id;
      entry.restoredAt = new Date();
      entry.restoreReason = restoreReason;
      await entry.save({ session });
    });
    res.json({ message: "Restored", restoredCount });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    next(error);
  }
}
