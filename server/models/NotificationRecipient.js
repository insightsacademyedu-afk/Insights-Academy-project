import { finiteNumbers } from "../utils/finiteNumbers.js";
import mongoose from "mongoose";

const { Schema } = mongoose;

// One row per (recipient, channel) pair, so a single announcement sent by
// email+SMS to 200 guardians produces 400 trackable delivery attempts, and
// a failure in one channel/recipient never blocks the others.
const notificationRecipientSchema = new Schema(
  {
    notification: { type: Schema.Types.ObjectId, ref: "Notification", required: true },

    // Polymorphic-ish reference: who this was addressed to. Kept simple
    // with a type+id pair rather than a Mongoose discriminator, since all
    // we ever do with it is look the contact info up once at send time.
    recipientType: { type: String, enum: ["guardian", "staff", "user"], required: true },
    recipientId: { type: Schema.Types.ObjectId, required: true },

    channel: { type: String, enum: ["in_app", "email", "sms", "whatsapp"], required: true },

    // Snapshot of the actual address/number used, so a later change to
    // the guardian's phone number doesn't rewrite delivery history.
    destination: { type: String, required: true, trim: true },

    status: {
      type: String,
      enum: ["pending", "processing", "sent", "delivered", "failed"],
      default: "pending",
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: "" },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Prevents the exact duplicate-send scenario the spec calls out: the same
// notification should never be queued twice to the same destination on
// the same channel, even if two guardians share one phone number, or a
// recipient resolution step runs twice by accident.
notificationRecipientSchema.index(
  { notification: 1, channel: 1, destination: 1 },
  { unique: true }
);
notificationRecipientSchema.index({ status: 1, channel: 1 }); // worker's queue-scan query

notificationRecipientSchema.plugin(finiteNumbers);
export default mongoose.model("NotificationRecipient", notificationRecipientSchema);
