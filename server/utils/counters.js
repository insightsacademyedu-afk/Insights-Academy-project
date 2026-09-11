import mongoose from "mongoose";

const { Schema } = mongoose;

// A dedicated counters collection with atomic findOneAndUpdate($inc) is the
// standard safe way to get sequential numbers in MongoDB — using
// countDocuments()+1 or reading-then-writing the last receipt number would
// race under concurrent requests and occasionally produce duplicates.
const counterSchema = new Schema({
  _id: { type: String, required: true }, // e.g. "receipt:2026"
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

export async function nextReceiptNumber(session = null) {
  const year = new Date().getFullYear();
  const key = `receipt:${year}`;

  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );

  return `RCPT-${year}-${String(counter.seq).padStart(5, "0")}`;
}
