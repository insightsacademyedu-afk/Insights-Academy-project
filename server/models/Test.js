import { finiteNumbers } from "../utils/finiteNumbers.js";
import mongoose from "mongoose";
import Class from "./Class.js";
import Section from "./Section.js";
import Subject from "./Subject.js";
import Staff from "./Staff.js";
import AcademicSession from "./AcademicSession.js";
import { validationError } from "../utils/modelValidation.js";

const { Schema } = mongoose;

const testSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    class: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    section: { type: Schema.Types.ObjectId, ref: "Section", required: true },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    academicSession: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true },

    // The teacher who created it — always the authenticated user's staffId,
    // set server-side, never trusted from the request body.
    createdBy: { type: Schema.Types.ObjectId, ref: "Staff", required: true },

    maxMarks: { type: Number, required: true, min: 1 },
    passingMarks: { type: Number, required: true, min: 0 },
    testDate: { type: Date, required: true },

    // draft: teacher is still entering marks, can freely edit
    // finalized: marks are locked; further changes must go through an
    //            amendment record (see TestResult.amendments below)
    status: { type: String, enum: ["draft", "finalized"], default: "draft" },
    finalizedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Admin-created tests bypass the isTeacherAuthorizedFor() check in
// testController.create() (only teachers go through that path — see
// "Admin creating on behalf of a teacher" there), so class/section/
// subject/academicSession/createdBy previously had NO existence check at
// all for that path, and no check anywhere that section actually belongs
// to class. Mirrors the pattern from TeacherClassAssignment, this
// project's highest-business-logic-risk phase per PROGRESS.md.
testSchema.pre("validate", async function (next) {
  if (this.passingMarks > this.maxMarks) {
    return next(validationError("passingMarks cannot exceed maxMarks"));
  }

  try {
    const [subjectExists, sessionExists, createdByExists, section] = await Promise.all([
      this.isModified("subject") ? Subject.exists({ _id: this.subject, archivedAt: null }) : true,
      this.isModified("academicSession") ? AcademicSession.exists({ _id: this.academicSession, archivedAt: null }) : true,
      this.isModified("createdBy") ? Staff.exists({ _id: this.createdBy, archivedAt: null }) : true,
      this.isModified("class") || this.isModified("section") ? Section.findOne({ _id: this.section, archivedAt: null }) : undefined,
    ]);

    if (!subjectExists) return next(validationError("Referenced subject does not exist"));
    if (!sessionExists) return next(validationError("Referenced academicSession does not exist"));
    if (!createdByExists) return next(validationError("Referenced createdBy staff does not exist"));

    if (this.isModified("class") || this.isModified("section")) {
      if (!section) return next(validationError("Referenced section does not exist"));
      const classDoc = await Class.findOne({ _id: this.class, archivedAt: null });
    if (!classDoc || String(classDoc.academicSession) !== String(this.academicSession)) return next(validationError("Class does not belong to this academic session"));
    if (String(section.class) !== String(this.class)) {
        return next(validationError("This section does not belong to the specified class"));
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});

testSchema.index({ class: 1, section: 1, subject: 1, academicSession: 1 });

testSchema.plugin(finiteNumbers);
export default mongoose.model("Test", testSchema);
