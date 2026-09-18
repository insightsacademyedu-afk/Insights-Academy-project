import mongoose from "mongoose";

const { Schema } = mongoose;

const academySettingsSchema = new Schema(
  {
    _id: { type: String, default: "academy" },
    academyName: { type: String, trim: true, maxlength: 120, default: "Academy Management" },
    academyPhone: { type: String, trim: true, maxlength: 40, default: "" },
    receiptName: { type: String, trim: true, maxlength: 120, default: "" },
    receiptPhone: { type: String, trim: true, maxlength: 40, default: "" },
    receiptFooter: { type: String, trim: true, maxlength: 500, default: "Thank you for your payment." },
  },
  { timestamps: true }
);

export default mongoose.model("AcademySettings", academySettingsSchema);
