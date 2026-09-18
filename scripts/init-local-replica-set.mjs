import mongoose from "../server/node_modules/mongoose/index.js";

const directUri = "mongodb://127.0.0.1:27017/admin?directConnection=true";
let connection;
try {
  connection = await mongoose.createConnection(directUri, { serverSelectionTimeoutMS: 15000 }).asPromise();
  const admin = connection.db.admin();
  const hello = await admin.command({ hello: 1 });
  if (!hello.setName) {
    try {
      await admin.command({ replSetInitiate: { _id: "academy-rs", members: [{ _id: 0, host: "127.0.0.1:27017" }] } });
    } catch (error) {
      if (error.codeName !== "AlreadyInitialized") throw error;
    }
  } else if (hello.setName !== "academy-rs") {
    throw new Error(`MongoDB already belongs to a different replica set: ${hello.setName}`);
  }
} finally {
  await connection?.close();
}

let ready = false;
for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    const check = await mongoose.createConnection("mongodb://127.0.0.1:27017/admin?replicaSet=academy-rs", { serverSelectionTimeoutMS: 2000 }).asPromise();
    const hello = await check.db.admin().command({ hello: 1 });
    await check.close();
    if (hello.setName === "academy-rs" && hello.isWritablePrimary) { ready = true; break; }
  } catch { /* election is still in progress */ }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!ready) throw new Error("Replica set did not become ready within 30 seconds");
console.log("MongoDB replica set academy-rs is ready.");
