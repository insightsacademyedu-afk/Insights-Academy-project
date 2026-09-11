import { finiteNumbers } from "../utils/finiteNumbers.js";
import mongoose from "mongoose";

const { Schema } = mongoose;

const expenseCategorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true }, // e.g. "Utilities", "Salaries", "Supplies"
    description: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

expenseCategorySchema.plugin(finiteNumbers);
export default mongoose.model("ExpenseCategory", expenseCategorySchema);
