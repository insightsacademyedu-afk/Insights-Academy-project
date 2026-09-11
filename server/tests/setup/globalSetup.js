import { MongoMemoryReplSet } from "mongodb-memory-server";

// This starts a REAL mongod binary (not a mock/emulation) as a single-node
// replica set — replica-set mode is required because several controllers
// (student enrollment, fee payments, salary mark-paid) use Mongo
// transactions, which only work on a replica set, exactly like your real
// Atlas cluster. This is the closest thing to "testing against a real
// database" that can run fully offline once the binary is cached.
//
// First run downloads the mongod binary (needs normal internet access —
// this will NOT work in network-locked sandboxes). After that it's cached
// under ~/.cache/mongodb-binaries and every subsequent run is fast and
// fully offline.
export default async function globalSetup() {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await replSet.waitUntilRunning();

  // Jest keeps `global` alive between globalSetup and globalTeardown
  // (they run in the same process), so stash the instance here to stop
  // it cleanly afterwards instead of leaking a mongod process.
  global.__MONGO_REPLSET__ = replSet;

  // These MUST be set before any test file imports app.js / config/env.js,
  // since env.js throws immediately if MONGO_URI or JWT_SECRET are missing.
  // globalSetup finishes before Jest loads any test file, so this is safe.
  process.env.NODE_ENV = "test";
  process.env.MONGO_URI = replSet.getUri();
  process.env.JWT_SECRET = "test-only-jwt-secret-do-not-use-in-prod";
  process.env.JWT_EXPIRES_IN = "1h";
  process.env.COOKIE_NAME = "ams_token_test";
  process.env.CLIENT_URL = "http://localhost:5173";
  process.env.LOGIN_MAX_ATTEMPTS = "5";
  process.env.LOGIN_LOCKOUT_MINUTES = "15";
  process.env.SEED_ADMIN_USERNAME = "admin";
  process.env.SEED_ADMIN_EMAIL = "admin@example.com";
  process.env.SEED_ADMIN_PASSWORD = "TestAdminPass123!";

  // eslint-disable-next-line no-console
  console.log(`[tests] mongod (replica set) ready at ${process.env.MONGO_URI}`);
}
