import { finiteNumbers } from "../utils/finiteNumbers.js";
import mongoose from "mongoose";
import { validationError } from "../utils/modelValidation.js";

const { Schema } = mongoose;

const subjectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    maxMarks: { type: Number, required: true, min: 1, default: 100 },
    passingMarks: { type: Number, required: true, min: 0, default: 40 },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

subjectSchema.index({ code: 1 }, { unique: true });

subjectSchema.pre("validate", function (next) {
  if (this.passingMarks > this.maxMarks) {
    return next(validationError("passingMarks cannot exceed maxMarks"));
  }
  next();
});

subjectSchema.plugin(finiteNumbers);
export default mongoose.model("Subject", subjectSchema);
