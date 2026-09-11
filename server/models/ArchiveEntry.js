import mongoose from "mongoose";

const { Schema } = mongoose;

const archiveChangeSchema = new Schema(
  {
    model: { type: String, required: true },
    documentId: { type: Schema.Types.ObjectId, required: true },
    previousStatus: { type: String, default: null },
  },
  { _id: false }
);

const archiveEntrySchema = new Schema(
  {
    resourceType: { type: String, required: true, index: true },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    label: { type: String, required: true, trim: true },
    reason: { type: String, required: true, trim: true, minlength: 3, maxlength: 500 },
    archivedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    archivedAt: { type: Date, required: true, default: Date.now },
      restoredBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      restoredAt: { type: Date, default: null },
      restoreReason: { type: String, default: "", trim: true, maxlength: 500 },
    state: { type: String, enum: ["archived", "restored"], default: "archived", index: true },
    changes: { type: [archiveChangeSchema], default: [] },
  },
  { timestamps: true }
);

archiveEntrySchema.index({ resourceType: 1, resourceId: 1, archivedAt: -1 });

export default mongoose.model("ArchiveEntry", archiveEntrySchema);
