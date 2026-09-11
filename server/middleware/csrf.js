import crypto from "crypto";
import { config } from "../config/env.js";

// Double-submit-cookie CSRF protection.
//
// Why this is needed: auth uses an httpOnly JWT cookie, which the browser
// will attach automatically to any request to our domain — including ones
// triggered by a malicious third-party site. A CSRF token stored in a
// *readable* (non-httpOnly) cookie lets our own frontend JS read it and
// echo it back in a custom header; a cross-site attacker can trigger the
// request but cannot read the cookie to forge that header value.

const CSRF_COOKIE = "ams_csrf";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Login has no pre-existing authenticated session to forge on behalf of,
// so there is nothing for CSRF to protect there — the browser has no
// httpOnly auth cookie yet. Every other state-changing route stays protected.
const EXEMPT_PATHS = new Set(["/api/auth/login"]);

export function issueCsrfCookie(req, res, next) {
  if (!req.cookies?.[CSRF_COOKIE]) {
    const token = crypto.randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // must be readable by frontend JS
      secure: config.isProd,
      sameSite: config.isProd ? "strict" : "lax",
      path: "/",
    });
  }
  next();
}

export function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (EXEMPT_PATHS.has(req.path)) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ message: "Invalid or missing CSRF token" });
  }

  next();
}
