import { finiteNumbers } from "../utils/finiteNumbers.js";
import mongoose from "mongoose";
import { validationError } from "../utils/modelValidation.js";

const { Schema } = mongoose;

const academicSessionSchema = new Schema(
  {
    // e.g. "2025-2026"
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    // HTTP changes serialize the current-session switch in a transaction.
    isCurrent: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
    },
  },
  { timestamps: true }
);

// The transaction serializes current-session switches through a shared lock record.
academicSessionSchema.pre("save", async function () {
  if (this.isCurrent && this.isModified("isCurrent")) {
    await this.constructor.db.collection("academysystemlocks").updateOne({ _id: "current-academic-session" }, { $inc: { version: 1 } }, { upsert: true, session: this.$session() });
    await this.constructor.updateMany({ _id: { $ne: this._id }, isCurrent: true }, { $set: { isCurrent: false } }, { session: this.$session() });
  }
});

academicSessionSchema.pre("validate", function (next) {
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    return next(validationError("endDate must be after startDate"));
  }
  next();
});

academicSessionSchema.plugin(finiteNumbers);
export default mongoose.model("AcademicSession", academicSessionSchema);
