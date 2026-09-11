import { moneyFields, sumMoney } from "../utils/money.js";
import { finiteNumbers } from "../utils/finiteNumbers.js";
import mongoose from "mongoose";
import Student from "./Student.js";
import AcademicSession from "./AcademicSession.js";
import { validationError } from "../utils/modelValidation.js";

const { Schema } = mongoose;

// One invoice per student per billing period. Generated from
// Student.feeDetails at creation time (a snapshot — if the student's fee
// structure changes later, past invoices are unaffected, which is what
// you want for an audit trail and for receipts that must never change
// retroactively).
const feeInvoiceSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    academicSession: { type: Schema.Types.ObjectId, ref: "AcademicSession", required: true },

    // e.g. "2026-01" for a monthly tuition invoice, or a one-off label
    // like "Admission Fee" / "Annual Exam Fee".
    period: { type: String, required: true, trim: true },
    invoiceType: {
      type: String,
      enum: ["tuition", "admission", "exam", "other"],
      default: "tuition",
    },

    // Snapshot of the amounts this invoice was generated from — never
    // recalculated from the live Student.feeDetails after creation.
    monthlyTuition: { type: Number, min: 0, default: 0 },
    admissionFee: { type: Number, min: 0, default: 0 },
    examFee: { type: Number, min: 0, default: 0 },
    otherFee: { type: Number, min: 0, default: 0 },
    discount: { type: Number, min: 0, default: 0 },
    scholarship: { type: Number, min: 0, default: 0 },

    // Denormalized, but always derived through computeInvoiceTotal() below
    // — never set directly by a controller — so there's one formula.
    totalAmount: { type: Number, min: 0, required: true },
    amountPaid: { type: Number, min: 0, default: 0 },

    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["unpaid", "partially_paid", "paid", "overdue", "waived"],
      default: "unpaid",
    },

    notes: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

// One invoice per student per period — prevents accidentally double-billing
// the same month.
feeInvoiceSchema.index({ student: 1, period: 1, invoiceType: 1 }, { unique: true });
feeInvoiceSchema.index({ student: 1, status: 1 });
feeInvoiceSchema.index({ academicSession: 1, status: 1 });

// Mongoose's ObjectId type only validates the *shape* of student/
// academicSession, not that the referenced document exists. Mirrors the
// existence-check pattern used by Class -> AcademicSession (models/Class.js)
// and TeacherClassAssignment.
feeInvoiceSchema.pre("validate", async function (next) {
  try {
    const [studentExists, sessionExists] = await Promise.all([
      this.isModified("student") ? Student.exists({ _id: this.student }) : true,
      this.isModified("academicSession") ? AcademicSession.exists({ _id: this.academicSession }) : true,
    ]);
    if (!studentExists) return next(validationError("Referenced student does not exist"));
    if (!sessionExists) return next(validationError("Referenced academicSession does not exist"));
    next();
  } catch (err) {
    next(err);
  }
});

// The one and only place invoice totals get computed.
export function computeInvoiceTotal(fields) {
  return Math.max(0, sumMoney(fields.monthlyTuition, fields.admissionFee, fields.examFee, fields.otherFee, -Number(fields.discount || 0), -Number(fields.scholarship || 0)));
}

// Keeps `status` consistent with amountPaid vs totalAmount so nothing has
// to remember to update it separately after every payment.
feeInvoiceSchema.methods.recomputeStatus = function recomputeStatus() {
  if (this.status === "waived") return; // waived is a manual, sticky state
  if (this.totalAmount <= 0) {
    this.status = "paid"; // fully discounted/scholarshipped — nothing owed
  } else if (this.amountPaid <= 0) {
    this.status = this.dueDate < new Date() ? "overdue" : "unpaid";
  } else if (this.amountPaid < this.totalAmount) {
    this.status = "partially_paid";
  } else {
    this.status = "paid";
  }
};

feeInvoiceSchema.plugin(finiteNumbers);
moneyFields(feeInvoiceSchema,["monthlyTuition","admissionFee","examFee","otherFee","discount","scholarship","totalAmount","amountPaid"]);
export default mongoose.model("FeeInvoice", feeInvoiceSchema);
