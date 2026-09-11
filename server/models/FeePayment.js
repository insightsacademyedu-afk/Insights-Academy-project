import { moneyFields } from "../utils/money.js";
import { finiteNumbers } from "../utils/finiteNumbers.js";
import mongoose from "mongoose";
import FeeInvoice from "./FeeInvoice.js";
import Student from "./Student.js";
import User from "./User.js";
import { validationError } from "../utils/modelValidation.js";

const { Schema } = mongoose;

// Payments are append-only. To correct a mistake, record a reversal
// (negative amount, method "adjustment") rather than editing or deleting
// a past payment — this keeps the audit trail (and any receipt already
// handed to a parent) truthful.
const feePaymentSchema = new Schema(
  {
    invoice: { type: Schema.Types.ObjectId, ref: "FeeInvoice", required: true },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },

    amount: { type: Number, required: true }, // negative allowed only for adjustments
    method: {
      type: String,
      enum: ["cash", "bank_transfer", "card", "online", "adjustment"],
      required: true,
    },
    reference: { type: String, trim: true, default: "" }, // e.g. bank slip / transaction id

    receiptNumber: { type: String, required: true, unique: true },

    receivedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    paidAt: { type: Date, default: Date.now },
    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

feePaymentSchema.index({ student: 1, paidAt: -1 });
feePaymentSchema.index({ invoice: 1 });

// Same existence-check rationale as FeeInvoice -> student/academicSession.
// recordPayment() in feeController already loads the invoice via
// findById before creating a payment, so this is a defense-in-depth
// backstop for any other caller (e.g. a future direct-model script).
feePaymentSchema.pre("validate", async function (next) {
  try {
    const [invoiceExists, studentExists, receivedByExists] = await Promise.all([
      this.isModified("invoice") ? FeeInvoice.exists({ _id: this.invoice }) : true,
      this.isModified("student") ? Student.exists({ _id: this.student }) : true,
      this.isModified("receivedBy") ? User.exists({ _id: this.receivedBy }) : true,
    ]);
    if (!invoiceExists) return next(validationError("Referenced invoice does not exist"));
    if (!studentExists) return next(validationError("Referenced student does not exist"));
    if (!receivedByExists) return next(validationError("Referenced receivedBy user does not exist"));
    next();
  } catch (err) {
    next(err);
  }
});

feePaymentSchema.plugin(finiteNumbers);
moneyFields(feePaymentSchema,["amount"]);
export default mongoose.model("FeePayment", feePaymentSchema);
