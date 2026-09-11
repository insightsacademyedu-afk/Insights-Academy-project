import { moneyFields, sumMoney } from "../utils/money.js";
import { finiteNumbers } from "../utils/finiteNumbers.js";
import mongoose from "mongoose";
import Staff from "./Staff.js";
import { validationError } from "../utils/modelValidation.js";

const { Schema } = mongoose;

const salaryPaymentSchema = new Schema(
  {
    staff: { type: Schema.Types.ObjectId, ref: "Staff", required: true },
    // e.g. "2026-01" — one record per staff per period, mirrors
    // FeeInvoice's `period` field for consistency across the codebase.
    period: { type: String, required: true, trim: true },

    // Snapshot at creation time — if Staff.basicSalary changes later,
    // already-created salary records for past periods are unaffected.
    baseAmount: { type: Number, required: true, min: 0 },
    bonuses: { type: Number, min: 0, default: 0 },
    deductions: { type: Number, min: 0, default: 0 },
    netAmount: { type: Number, required: true, min: 0 }, // always via computeNetSalary()

    status: { type: String, enum: ["pending", "paid"], default: "pending" },
    paidAt: { type: Date, default: null },
    paidBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

salaryPaymentSchema.index({ staff: 1, period: 1 }, { unique: true });
salaryPaymentSchema.index({ status: 1, period: 1 });

// salaryController.create() already checks Staff.findById() before calling
// SalaryPayment.create(), but this is defense-in-depth for any other
// caller, mirroring the existence-check pattern used everywhere else.
salaryPaymentSchema.pre("validate", async function (next) {
  try {
    if (this.isModified("staff")) {
      const exists = await Staff.exists({ _id: this.staff, archivedAt: null });
      if (!exists) return next(validationError("Referenced staff does not exist"));
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Single formula, mirrors FeeInvoice's computeInvoiceTotal() pattern.
export function computeNetSalary({ baseAmount, bonuses = 0, deductions = 0 }) {
  return Math.max(0, sumMoney(baseAmount, bonuses, -Number(deductions || 0)));
}

salaryPaymentSchema.plugin(finiteNumbers);
moneyFields(salaryPaymentSchema,["baseAmount","bonuses","deductions","netAmount"]);
export default mongoose.model("SalaryPayment", salaryPaymentSchema);
