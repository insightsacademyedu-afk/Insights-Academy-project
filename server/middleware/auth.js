import { config } from "../config/env.js";
import { verifyToken } from "../utils/token.js";
import Staff from "../models/Staff.js";
import User from "../models/User.js";

// Verifies the JWT cookie, then re-checks the user record on every request
// so that a deactivated account or a bumped tokenVersion (forced logout)
// takes effect immediately, not just after the token naturally expires.
export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[config.cookieName];
    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return res.status(401).json({ message: "Invalid or expired session" });
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: "Account no longer exists" });
    }
    if (user.status !== "active") {
      return res.status(403).json({ message: "Account is deactivated" });
    }
    if (user.role === "staff" && (!user.staffId || !await Staff.exists({ _id: user.staffId, status: "active", archivedAt: null }))) {
      return res.status(403).json({ message: "Staff profile is inactive or unavailable" });
    }
    if (user.tokenVersion !== payload.tokenVersion) {
      return res.status(401).json({ message: "Session has been invalidated, please log in again" });
    }

    req.user = user; // full mongoose doc, downstream middleware/controllers can use it
    next();
  } catch (err) {
    next(err);
  }
}

// Usage: requireRole("admin") or requireRole("admin", "staff")
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "You do not have permission to perform this action" });
    }
    next();
  };
}
