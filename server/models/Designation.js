import { finiteNumbers } from "../utils/finiteNumbers.js";
import mongoose from "mongoose";

const { Schema } = mongoose;

const designationSchema = new Schema(
  {
    // e.g. "Mathematics Teacher", "Coordinator"
    title: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

// Note: per the spec, designation is descriptive only — it must never be
// used as a security/permission mechanism. Actual access control for
// teachers comes from TeacherClassAssignment records (Phase 3).

designationSchema.plugin(finiteNumbers);
export default mongoose.model("Designation", designationSchema);
