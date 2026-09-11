import { finiteNumbers } from "../utils/finiteNumbers.js";
import mongoose from "mongoose";
import Class from "./Class.js";
import { validationError } from "../utils/modelValidation.js";

const { Schema } = mongoose;

const sectionSchema = new Schema(
  {
    // e.g. "A", "B"
    name: { type: String, required: true, trim: true },
    class: {
      type: Schema.Types.ObjectId,
      ref: "Class",
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

sectionSchema.index({ name: 1, class: 1 }, { unique: true });

// Same existence-check rationale as Class -> AcademicSession above.
sectionSchema.pre("validate", async function (next) {
  if (!this.isModified("class")) return next();
  try {
    const exists = await Class.exists({ _id: this.class, archivedAt: null });
    if (!exists) {
      return next(validationError("Referenced class does not exist"));
    }
    next();
  } catch (err) {
    next(err);
  }
});

sectionSchema.plugin(finiteNumbers);
export default mongoose.model("Section", sectionSchema);
