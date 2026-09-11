// Run with: npm run seed:admin
// Intentionally a CLI script, not an HTTP endpoint — creating the first
// admin (or recovering access) should never be reachable over the web.

import { config } from "../config/env.js";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import mongoose from "mongoose";

const DEFAULT_SEED_PASSWORD = "ChangeThisPassword123!";

async function run() {
  const { username, email, password } = config.seedAdmin;

  // Same reasoning as config/env.js's JWT_SECRET check: this script is the
  // one place a real admin account gets its first password, so it's worth
  // refusing outright in production rather than silently creating an admin
  // whose password is the exact string checked into .env.example.
  if (config.isProd && password === DEFAULT_SEED_PASSWORD) {
    console.error(
      "[seed] Refusing to create an admin with the default SEED_ADMIN_PASSWORD in production. " +
        "Set a real SEED_ADMIN_PASSWORD in your environment first."
    );
    process.exit(1);
  }

  await connectDB();

  const existing = await User.findOne({ $or: [{ username }, { email }] });
  if (existing) {
    console.log(`[seed] user "${username}" already exists — no changes made.`);
    console.log("[seed] If you need to reset the password, do it directly via this script logic, not a web route.");
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await User.hashPassword(password);

  const admin = await User.create({
    username,
    email,
    passwordHash,
    role: "admin",
    status: "active",
  });

  console.log("[seed] Admin user created:");
  console.log(`  username: ${admin.username}`);
  console.log(`  email:    ${admin.email}`);
  console.log("  Log in with the password from SEED_ADMIN_PASSWORD in your .env, then change it.");

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
