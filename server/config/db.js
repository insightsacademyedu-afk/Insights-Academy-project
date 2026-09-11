import dns from "node:dns";
import mongoose from "mongoose";

async function resolveAtlasSrvUri(uri) {
  if (!uri.startsWith("mongodb+srv://")) return uri;

  const parsed = new URL(uri.replace("mongodb+srv://", "mongodb://"));
  const resolveDnsOverHttps = (name, type) =>
    fetch(`https://dns.google/resolve?name=${name}&type=${type}`).then((response) => response.json());
  const [srvResponse, txtResponse] = await Promise.all([
    resolveDnsOverHttps(`_mongodb._tcp.${parsed.hostname}`, "SRV"),
    resolveDnsOverHttps(parsed.hostname, "TXT"),
  ]);

  const hosts = srvResponse.Answer?.filter((answer) => answer.type === 33).map((answer) => {
    const [, , port, name] = answer.data.split(" ");
    return { name: name.replace(/\.$/, ""), port };
  }) || [];
  if (!hosts.length) throw new Error(`No MongoDB SRV records found for ${parsed.hostname}`);
  const txt = txtResponse.Answer?.find((answer) => answer.type === 16)?.data?.replace(/^"|"$/g, "");
  const options = new URLSearchParams(parsed.search);
  if (txt) {
    for (const [key, value] of new URLSearchParams(txt)) {
      if (!options.has(key)) options.set(key, value);
    }
  }
  options.set("tls", "true");

  const credentials = parsed.username
    ? `${parsed.username}:${parsed.password}@`
    : "";
  const seedList = hosts.map(({ name, port }) => `${name}:${port}`).join(",");
  return `mongodb://${credentials}${seedList}${parsed.pathname || "/"}?${options}`;
}

// Some networks/routers cause Node's bundled DNS resolver to fail SRV
// lookups (mongodb+srv://...) with ECONNREFUSED even though the system
// resolver (nslookup, etc.) works fine — a known Node quirk, not a bug in
// this app or in Atlas. Explicitly pointing Node at public DNS servers
// works around it.
if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(",").map(s => s.trim()));

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not set in the environment");
  }

  mongoose.set("strictQuery", true);

  let connectionUri = uri;
  try {
    await mongoose.connect(connectionUri, { autoIndex: process.env.NODE_ENV !== "production", serverSelectionTimeoutMS: 15000 });
  } catch (error) {
    const dnsLookupFailed = /query(?:Txt|Srv)\s+(?:ETIMEOUT|ECONNREFUSED|ENOTFOUND)/i.test(error.message || "");
    if (!uri.startsWith("mongodb+srv://") || (!dnsLookupFailed && !["ETIMEOUT", "ECONNREFUSED", "ENOTFOUND"].includes(error.code))) throw error;
    connectionUri = await resolveAtlasSrvUri(uri);
    await mongoose.connect(connectionUri, { autoIndex: process.env.NODE_ENV !== "production", serverSelectionTimeoutMS: 15000 });
  }

  console.log(`[db] connected to MongoDB (${mongoose.connection.name})`);

  mongoose.connection.on("error", (err) => {
    console.error("[db] connection error:", err.message);
  });
}