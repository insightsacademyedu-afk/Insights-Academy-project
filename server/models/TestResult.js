import { finiteNumbers } from "../utils/finiteNumbers.js";
import mongoose from "mongoose";
import Test from "./Test.js";
import Student from "./Student.js";
import { validationError } from "../utils/modelValidation.js";

const { Schema } = mongoose;

// Every correction made after a Test is finalized is appended here rather
// than silently overwriting marksObtained — this is the audit trail the
// spec requires for "amendment mechanism for post-finalization edits."
const amendmentSchema = new Schema(
  {
    previousMarks: { type: Number, required: true },
    newMarks: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    amendedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amendedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const testResultSchema = new Schema(
  {
    test: { type: Schema.Types.ObjectId, ref: "Test", required: true },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    marksObtained: { type: Number, required: true, min: 0 },
    remarks: { type: String, trim: true, default: "" },
    amendments: { type: [amendmentSchema], default: [] },
  },
  { timestamps: true }
);

testResultSchema.index({ test: 1, student: 1 }, { unique: true });
testResultSchema.index({ student: 1 });

// testController.enterMarks() already cross-checks every student against
// StudentClassAssignment for the test's class/section before upserting
// here (a fake id fails that check first), and always loads `test` via
// loadTestForMutation() before creating a result — so in the normal HTTP
// flow this is defense-in-depth, not a live bug. Added anyway for
// consistency with the rest of the codebase's existence-check pattern.
testResultSchema.pre("validate", async function (next) {
  try {
    const [testExists, studentExists] = await Promise.all([
      this.isModified("test") ? Test.exists({ _id: this.test }) : true,
      this.isModified("student") ? Student.exists({ _id: this.student }) : true,
    ]);
    if (!testExists) return next(validationError("Referenced test does not exist"));
    if (!studentExists) return next(validationError("Referenced student does not exist"));
    next();
  } catch (err) {
    next(err);
  }
});

testResultSchema.plugin(finiteNumbers);
export default mongoose.model("TestResult", testResultSchema);
