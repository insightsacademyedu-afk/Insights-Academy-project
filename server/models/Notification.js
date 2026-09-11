import { finiteNumbers } from "../utils/finiteNumbers.js";
import mongoose from "mongoose";

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },

    // Which delivery channels to attempt. "in_app" always succeeds
    // immediately since it's just a DB row the frontend reads.
    channels: {
      type: [String],
      enum: ["in_app", "email", "sms", "whatsapp"],
      default: ["in_app"],
    },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // Free-form targeting description for the admin's own reference
    // (e.g. "Class 10 - Section A guardians"). Actual recipients are
    // resolved into NotificationRecipient rows at creation time so later
    // changes to class rosters don't retroactively change who was sent what.
    audienceDescription: { type: String, trim: true, default: "" },

    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
    },
  },
  { timestamps: true }
);

notificationSchema.plugin(finiteNumbers);
export default mongoose.model("Notification", notificationSchema);
