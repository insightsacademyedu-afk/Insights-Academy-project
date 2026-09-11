export default async function globalTeardown() {
  const replSet = global.__MONGO_REPLSET__;
  if (replSet) {
    await replSet.stop();
  }
}
