import { config } from "./config/env.js";
import { connectDB } from "./config/db.js";
import app from "./app.js";
import mongoose from "mongoose";

async function start() {
  await connectDB();

  const server = app.listen(config.port, config.host, () => {
    console.log(`[server] listening on ${config.host}:${config.port} (${config.nodeEnv})`);
  });
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
    const timer = setTimeout(() => process.exit(1), 10000);
    timer.unref();
    server.close(async () => { await mongoose.disconnect(); process.exit(0); });
  });
}

start().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
