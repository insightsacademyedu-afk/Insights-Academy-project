import { finiteNumbers } from "../utils/finiteNumbers.js";
import mongoose from "mongoose";
import AcademicSession from "./AcademicSession.js";
import { validationError } from "../utils/modelValidation.js";

const { Schema } = mongoose;

const classSchema = new Schema(
  {
    // e.g. "10th", "Grade 5"
    name: { type: String, required: true, trim: true },
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

// A class name should be unique within a given session, but the same
// name can be reused across sessions (e.g. "10th" exists every year).
classSchema.index({ name: 1, academicSession: 1 }, { unique: true });

// Mongoose's ObjectId type only validates the *shape* of the id, not that
// the referenced document exists — a class pointing at a deleted/fake
// session would otherwise be created silently. Mirrors the existence-check
// pattern already used by TeacherClassAssignment/StudentClassAssignment.
classSchema.pre("validate", async function (next) {
  if (!this.isModified("academicSession")) return next();
  try {
    const exists = await AcademicSession.exists({ _id: this.academicSession, archivedAt: null });
    if (!exists) {
      return next(validationError("Referenced academicSession does not exist"));
    }
    next();
  } catch (err) {
    next(err);
  }
});

classSchema.plugin(finiteNumbers);
export default mongoose.model("Class", classSchema);
