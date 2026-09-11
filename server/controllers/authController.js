import { config } from "../config/env.js";
import User from "../models/User.js";
import { signToken, getCookieOptions } from "../utils/token.js";

const GENERIC_LOGIN_ERROR = "Invalid username or password";

export async function login(req, res, next) {
  try {
    if (req.get("origin") && req.get("origin") !== config.clientUrl) return res.status(403).json({ message: "Untrusted login origin" });
    const { username, password } = req.body;

    if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    // select("+passwordHash") because the schema hides it by default
    const user = await User.findOne({
      username: String(username).trim().toLowerCase(),
    }).select("+passwordHash +failedLoginAttempts +lockUntil +tokenVersion");

    // Same generic message whether the user exists or not, to avoid
    // leaking which usernames are registered.
    if (!user) {
      return res.status(401).json({ message: GENERIC_LOGIN_ERROR });
    }

    if (user.isLocked()) {
      const minutesLeft = Math.ceil((user.lockUntil - new Date()) / 60000);
      return res.status(423).json({
        message: `Account temporarily locked. Try again in ${minutesLeft} minute(s).`,
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({ message: "Account is deactivated. Contact your administrator." });
    }

    const passwordMatches = await user.comparePassword(password);

    if (!passwordMatches) {
      user.failedLoginAttempts += 1;

      if (user.failedLoginAttempts >= config.loginMaxAttempts) {
        user.lockUntil = new Date(Date.now() + config.loginLockoutMinutes * 60 * 1000);
        user.failedLoginAttempts = 0; // reset counter for the next window after lock expires
      }

      await user.save();
      return res.status(401).json({ message: GENERIC_LOGIN_ERROR });
    }

    // Successful login: reset counters, update lastLogin
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = new Date();
    await user.save();

    const token = signToken(user);
    res.cookie(config.cookieName, token, getCookieOptions());

    return res.json({ user: user.toJSON() });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res) {
  res.clearCookie(config.cookieName, { path: "/" });
  return res.json({ message: "Logged out" });
}

export async function me(req, res) {
  // req.user is set by requireAuth
  return res.json({ user: req.user.toJSON() });
}

export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (typeof currentPassword !== 'string' || !currentPassword || Buffer.byteLength(currentPassword, 'utf8') > 72 ||
        typeof newPassword !== 'string' || newPassword.length < 12 || Buffer.byteLength(newPassword, 'utf8') > 72) {
      return res.status(400).json({ message: 'Enter your current password and a new password of at least 12 characters (maximum 72 UTF-8 bytes).' });
    }
    if (newPassword !== confirmPassword) return res.status(400).json({ message: 'New passwords do not match.' });
    if (newPassword === currentPassword) return res.status(400).json({ message: 'Choose a different new password.' });
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user || !await user.comparePassword(currentPassword)) return res.status(400).json({ message: 'Current password is incorrect.' });
    const passwordHash = await User.hashPassword(newPassword);
    // Compare-and-swap prevents competing changes or an admin reset from being overwritten.
    const updated = await User.findOneAndUpdate({ _id: user._id, status: 'active', passwordHash: user.passwordHash, tokenVersion: req.user.tokenVersion },
      { $set: { passwordHash, failedLoginAttempts: 0, lockUntil: null }, $inc: { tokenVersion: 1 } }, { new: true });
    if (!updated) return res.status(409).json({ message: 'Your account changed. Sign in again before changing your password.' });
    res.cookie(config.cookieName, signToken(updated), getCookieOptions());
    return res.json({ message: 'Password changed. Other sessions have been signed out.' });
  } catch (error) { next(error); }
}
