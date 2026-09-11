import { moneyFields } from "../utils/money.js";
import { finiteNumbers } from "../utils/finiteNumbers.js";
import mongoose from "mongoose";
import Designation from "./Designation.js";
import { validationError } from "../utils/modelValidation.js";

const { Schema } = mongoose;

const staffSchema = new Schema(
  {
    // Linked User account (login credentials). Optional at creation time —
    // an admin may create a staff profile first and issue login access later.
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    fullName: { type: String, required: true, trim: true },
    designation: {
      type: Schema.Types.ObjectId,
      ref: "Designation",
      default: null,
    },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    joiningDate: { type: Date, default: null },
    basicSalary: { type: Number, min: 0, default: 0 },
    salaryType: {
      type: String,
      enum: ["monthly", "hourly", "contract"],
      default: "monthly",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

staffSchema.pre("validate", async function () {
  if (this.designation && this.isModified("designation") && !await Designation.exists({ _id: this.designation, archivedAt: null })) throw validationError("Referenced designation does not exist");
});

staffSchema.plugin(finiteNumbers);
moneyFields(staffSchema,["basicSalary"]);
export default mongoose.model("Staff", staffSchema);
