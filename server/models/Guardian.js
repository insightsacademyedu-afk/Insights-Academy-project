import { finiteNumbers } from "../utils/finiteNumbers.js";
import mongoose from "mongoose";

const { Schema } = mongoose;

const guardianSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    relationship: { type: String, trim: true, default: "Father" }, // Father/Mother/Guardian/Other
    primaryPhone: { type: String, required: true, trim: true },
    secondaryPhone: { type: String, trim: true, default: "" },
    whatsappPhone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    address: { type: String, trim: true, default: "" },
    emergencyContact: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

// Speeds up "same phone number belongs to N students" dedup checks used
// later by the notification system (Phase 8) to avoid duplicate sends.
guardianSchema.index({ primaryPhone: 1 });
guardianSchema.index({ whatsappPhone: 1 });

guardianSchema.plugin(finiteNumbers);
export default mongoose.model("Guardian", guardianSchema);
