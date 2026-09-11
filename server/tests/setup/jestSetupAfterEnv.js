import mongoose from "mongoose";

// Jest gives each test FILE a fresh module registry, so each file gets its
// own `mongoose` import and its own connection to the shared mongod started
// once in globalSetup. Connect before that file's tests run...
beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }
});

// ...wipe every collection between individual tests so one test's data
// never leaks into the next (within a file, and since files run
// sequentially via --runInBand, across files too)...
afterEach(async () => {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

// ...and close the connection when the file is done.
afterAll(async () => {
  await mongoose.connection.close();
});
