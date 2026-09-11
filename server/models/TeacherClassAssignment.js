import { finiteNumbers } from "../utils/finiteNumbers.js";
import mongoose from "mongoose";
import Class from "./Class.js";
import Section from "./Section.js";
import Staff from "./Staff.js";
import Subject from "./Subject.js";
import AcademicSession from "./AcademicSession.js";
import { validationError } from "../utils/modelValidation.js";

const { Schema } = mongoose;

// This collection is the single source of truth for teacher permissions.
// Every teacher-facing query in every later phase (students, tests, exams,
// marks) must be scoped through this table — never through a "teacherId"
// field stored directly on a student or a designation title.
const teacherClassAssignmentSchema = new Schema(
  {
    teacher: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
    class: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    section: {
      type: Schema.Types.ObjectId,
      ref: "Section",
      required: true,
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    academicSession: {
      type: Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

// The same teacher can't be assigned to teach the same subject in the same
// section twice within the same session.
teacherClassAssignmentSchema.index(
  { teacher: 1, class: 1, section: 1, subject: 1, academicSession: 1 },
  { unique: true }
);

// Fast lookups by teacher (used on every scoping check) and by
// class/section/subject (used when admins view "who teaches this").
teacherClassAssignmentSchema.index({ teacher: 1, status: 1 });
teacherClassAssignmentSchema.index({ class: 1, section: 1, subject: 1 });

teacherClassAssignmentSchema.pre("validate", async function (next) {
  try {
    // `class` existence is implicitly covered below (a fake class id can
    // never equal a real section's class), but teacher/subject/session
    // need their own explicit checks — nothing else validates them.
    const [teacherExists, subjectExists, sessionExists, section] = await Promise.all([
      this.isModified("teacher") ? Staff.exists({ _id: this.teacher, archivedAt: null }) : true,
      this.isModified("subject") ? Subject.exists({ _id: this.subject, archivedAt: null }) : true,
      this.isModified("academicSession") ? AcademicSession.exists({ _id: this.academicSession, archivedAt: null }) : true,
      Section.findOne({ _id: this.section, archivedAt: null }),
    ]);

    if (!teacherExists) return next(validationError("Referenced teacher does not exist"));
    if (!subjectExists) return next(validationError("Referenced subject does not exist"));
    if (!sessionExists) return next(validationError("Referenced academicSession does not exist"));
    if (!section) {
      return next(validationError("Referenced section does not exist"));
    }
    const classDoc = await Class.findOne({ _id: this.class, archivedAt: null });
    if (!classDoc || String(classDoc.academicSession) !== String(this.academicSession)) return next(validationError("Class does not belong to this academic session"));
    if (String(section.class) !== String(this.class)) {
      return next(validationError("This section does not belong to the specified class"));
    }
    next();
  } catch (err) {
    next(err);
  }
});

teacherClassAssignmentSchema.plugin(finiteNumbers);
export default mongoose.model("TeacherClassAssignment", teacherClassAssignmentSchema);
