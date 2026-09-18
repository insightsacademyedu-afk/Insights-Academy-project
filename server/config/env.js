import dotenv from "dotenv";
import dns from "node:dns";

dotenv.config({ path: new URL("../.env", import.meta.url) });

const dnsServers = String(process.env.DNS_SERVERS || "")
  .split(",")
  .map((server) => server.trim())
  .filter(Boolean);
if (dnsServers.length) dns.setServers(dnsServers);

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const isProd = process.env.NODE_ENV === "production";

// Phase 10 hardening: the app would otherwise happily boot in production
// with the exact placeholder secret checked into .env.example, or a secret
// short enough to brute-force. Fail fast at startup instead of leaving a
// weak JWT signing key as a silent runtime risk — this is the same
// "loud failure beats a quiet vulnerability" reasoning already applied to
// `required()` above for a missing var entirely, just extended to an
// insecure value for this one specifically since forging a session cookie
// is a full account-takeover primitive, unlike the app's other env vars.
const PLACEHOLDER_JWT_SECRETS = new Set(["replace-with-a-long-random-secret", "secret", "changeme"]);
function assertStrongJwtSecret(secret) {
  if (!isProd) return secret; // dev/test convenience — never gate local iteration
  if (PLACEHOLDER_JWT_SECRETS.has(secret) || secret.length < 32) {
    throw new Error(
      "JWT_SECRET is missing, a known placeholder, or too short (< 32 chars) for production. " +
        "Generate a real random secret, e.g. `openssl rand -hex 32`."
    );
  }
  return secret;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProd,
  serveClient: isProd || process.env.SERVE_CLIENT === "true",
  port: Number(process.env.PORT) || 5000,
  host: process.env.HOST || (isProd ? "0.0.0.0" : "127.0.0.1"),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",

  mongoUri: required("MONGO_URI"),

  jwtSecret: assertStrongJwtSecret(required("JWT_SECRET")),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  cookieName: process.env.COOKIE_NAME || "ams_token",

  loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS) || 5,
  loginLockoutMinutes: Number(process.env.LOGIN_LOCKOUT_MINUTES) || 15,

  seedAdmin: {
    username: process.env.SEED_ADMIN_USERNAME || "admin",
    email: process.env.SEED_ADMIN_EMAIL || "admin@example.com",
    password: process.env.SEED_ADMIN_PASSWORD || "ChangeThisPassword123!",
  },

};
