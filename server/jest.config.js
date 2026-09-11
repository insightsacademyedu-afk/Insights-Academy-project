/**
 * Jest config for an ESM ("type": "module") project.
 *
 * Run via: npm test
 * (which invokes `node --experimental-vm-modules node_modules/.bin/jest --runInBand`)
 *
 * --runInBand matters here: all test files share ONE MongoMemoryReplSet
 * started once in globalSetup, so we don't want multiple Jest workers
 * racing to start their own mongod instances or stepping on each other's
 * rate-limiter state. Running in-band also means globalSetup's
 * process.env writes are visible to every test file (same process).
 */
export default {
  testEnvironment: "node",
  globalSetup: "./tests/setup/globalSetup.js",
  globalTeardown: "./tests/setup/globalTeardown.js",
  setupFilesAfterEnv: ["./tests/setup/jestSetupAfterEnv.js"],
  testMatch: ["**/tests/**/*.test.js"],
  // mongodb-memory-server + a real mongod boot can be slow on first run
  // (binary download/extraction happens once, then it's cached).
  testTimeout: 30000,
  verbose: true,
};
