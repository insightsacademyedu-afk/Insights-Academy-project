import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set in the environment");

  mongoose.set("strictQuery", true);
  const toPositiveInt = (name, fallback) => {
    const value = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };

  await mongoose.connect(uri, {
    autoIndex: process.env.MONGO_AUTO_INDEX !== "false",
    maxPoolSize: toPositiveInt("MONGO_MAX_POOL_SIZE", 50),
    minPoolSize: toPositiveInt("MONGO_MIN_POOL_SIZE", 5),
    maxIdleTimeMS: toPositiveInt("MONGO_MAX_IDLE_TIME_MS", 300000),
    waitQueueTimeoutMS: toPositiveInt("MONGO_WAIT_QUEUE_TIMEOUT_MS", 5000),
    connectTimeoutMS: toPositiveInt("MONGO_CONNECT_TIMEOUT_MS", 10000),
    socketTimeoutMS: toPositiveInt("MONGO_SOCKET_TIMEOUT_MS", 30000),
    serverSelectionTimeoutMS: toPositiveInt("MONGO_SERVER_SELECTION_TIMEOUT_MS", 5000),
  });
  console.log(`[db] connected to MongoDB (${mongoose.connection.name})`);
  mongoose.connection.on("error", (error) => console.error("[db] connection error:", error.message));
}
