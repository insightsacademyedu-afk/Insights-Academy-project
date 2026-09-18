import mongoose from "mongoose";

const { Schema } = mongoose;

const sequenceSchema = new Schema(
  {
    _id: { type: String, required: true },
    value: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Sequence", sequenceSchema);
