import { config } from "../config/env.js";

// 404 handler for unmatched routes
export function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Centralized error handler. Keep messages generic in production so we
// never leak stack traces, file paths, or query details to clients.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error("[error]", err.name || "Error", err.status || err.statusCode || "");
  if (err.name === "ValidationError" || err.name === "CastError" && err.kind !== "ObjectId") {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === 11000) return res.status(409).json({ message: "A record with these values already exists" });

  // A malformed ObjectId in a URL param (e.g. GET /api/fees/invoices/not-an-id)
  // throws a Mongoose CastError, which has no err.status/statusCode of its
  // own — every route in this codebase relies on this handler for the
  // client-mistake-vs-server-problem split, so without this check a bad id
  // silently fell through to a generic 500 instead of the 400 it actually
  // is. Same class of gap as the custom pre("validate") hooks that used to
  // return 500 for a ValidationError before utils/modelValidation.js fixed
  // that — Phase 10 hardening pass caught this one at the shared boundary
  // instead of per-route.
  if (err.name === "CastError" && err.kind === "ObjectId") {
    return res.status(400).json({ message: `Invalid id: ${err.value}` });
  }

  // A JSON body that fails to parse (malformed input, not a client typo in
  // a field value) comes from body-parser/express.json as a SyntaxError
  // with a `status`/`statusCode` of 400 already set — but express.json
  // also sets `err.type === "entity.parse.failed"`, and without this check
  // its raw message (which can include a snippet of the invalid body) was
  // passed straight through to the client. Keep the 400, generalize the
  // message.
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Malformed JSON in request body" });
  }

  const status = err.status || err.statusCode || 500;

  const body = {
    message: status === 500 && config.isProd ? "Internal server error" : err.message,
  };

  if (!config.isProd) {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}
