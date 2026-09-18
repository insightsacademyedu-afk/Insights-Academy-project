import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set in the environment");

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { autoIndex: true, serverSelectionTimeoutMS: 5000 });
  console.log(`[db] connected to MongoDB (${mongoose.connection.name})`);
  mongoose.connection.on("error", (error) => console.error("[db] connection error:", error.message));
}
