import { finiteNumbers } from "../utils/finiteNumbers.js";
import mongoose from "mongoose";
import Class from "./Class.js";
import Section from "./Section.js";
import Student from "./Student.js";
import AcademicSession from "./AcademicSession.js";
import { validationError } from "../utils/modelValidation.js";

const { Schema } = mongoose;

// Mirrors TeacherClassAssignment's philosophy: a student's class placement
// is never a single field on the Student document. Storing it here lets a
// student have a different class/section every academic session without
// old records ever being overwritten (needed for the Phase-11+ class
// promotion workflow, and for academic history that spans years).
const studentClassAssignmentSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "Student",
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
    academicSession: {
      type: Schema.Types.ObjectId,
      ref: "AcademicSession",
      required: true,
    },
    rollNumber: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["active", "transferred_out", "completed"],
      default: "active",
    },
  },
  { timestamps: true }
);

// A student can only have one assignment per session.
studentClassAssignmentSchema.index({ student: 1, academicSession: 1 }, { unique: true });

// Roll numbers must be unique within a class/section/session.
studentClassAssignmentSchema.index(
  { class: 1, section: 1, academicSession: 1, rollNumber: 1 },
  { unique: true }
);

// Fast lookups for "which students are in this class/section" (used by
// the teacher-scoped student list).
studentClassAssignmentSchema.index({ class: 1, section: 1, academicSession: 1 });

studentClassAssignmentSchema.pre("validate", async function (next) {
  try {
    const dbSession = this.$session();
    const [student, academicSession, section] = await Promise.all([
      Student.exists({ _id: this.student, archivedAt: null }).session(dbSession),
      AcademicSession.exists({ _id: this.academicSession, archivedAt: null }).session(dbSession),
      Section.findOne({ _id: this.section, archivedAt: null }).session(dbSession),
    ]);
    if (!student) return next(validationError("Referenced student does not exist"));
    if (!academicSession) return next(validationError("Referenced academicSession does not exist"));
    if (!section) return next(validationError("Referenced section does not exist"));
    const classDoc = await Class.findOne({ _id: this.class, archivedAt: null }).session(dbSession);
    if (!classDoc || String(classDoc.academicSession) !== String(this.academicSession)) return next(validationError("Class does not belong to this academic session"));
    if (String(section.class) !== String(this.class)) {
      return next(validationError("This section does not belong to the specified class"));
    }
    next();
  } catch (err) {
    next(err);
  }
});

studentClassAssignmentSchema.plugin(finiteNumbers);
export default mongoose.model("StudentClassAssignment", studentClassAssignmentSchema);
