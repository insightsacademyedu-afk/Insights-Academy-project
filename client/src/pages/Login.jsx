import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { requestPasswordReset, resetPassword } from "../api/auth";
import { Field, PasswordInput, TextInput } from "../components/FormFields";

export default function Login() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [resetForm, setResetForm] = useState({ email: "", code: "", newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated") {
    return <Navigate to={location.state?.from?.pathname || "/"} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (err) {
      setError(err.message || "Couldn't sign in. Check your username and password.");
    } finally {
      setSubmitting(false);
    }
  }

  async function requestCode(event) {
    event.preventDefault();
    setError(""); setSubmitting(true);
    try {
      await requestPasswordReset(resetForm.email);
      setMode("reset");
    } catch (err) { setError(err.message || "The reset code could not be requested."); }
    finally { setSubmitting(false); }
  }

  async function submitReset(event) {
    event.preventDefault();
    setError("");
    if (resetForm.newPassword !== resetForm.confirmPassword) { setError("New passwords do not match."); return; }
    setSubmitting(true);
    try {
      await resetPassword(resetForm);
      setMode("login"); setPassword(""); setResetForm({ email: "", code: "", newPassword: "", confirmPassword: "" });
      setError("Password reset successfully. You can now sign in.");
    } catch (err) { setError(err.message || "The password could not be reset."); }
    finally { setSubmitting(false); }
  }

  function showLogin() {
    setMode("login"); setError(""); setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <svg viewBox="0 0 32 32" className="h-11 w-11 mb-4">
            <path
              d="M16 6 L26 11 V16 C26 22 21.5 25.8 16 27 C10.5 25.8 6 22 6 16 V11 Z"
              fill="none"
              stroke="#C7952F"
              strokeWidth="1.4"
            />
            <line x1="16" y1="10" x2="16" y2="22" stroke="#C7952F" strokeWidth="1.1" />
            <line x1="11" y1="13" x2="21" y2="13" stroke="#C7952F" strokeWidth="1.1" />
          </svg>
          <h1 className="font-display text-2xl text-paper-50">Ledger</h1>
          <p className="text-ink-400 text-sm mt-1">Academy Management System</p>
        </div>

        {mode === "login" && <form onSubmit={handleSubmit} className="bg-paper-50 rounded-lg p-7 shadow-2xl shadow-black/30">
          <h2 className="font-display text-lg text-ink-950 mb-5">Sign in</h2>

          {error && (
            <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">
              {error}
            </div>
          )}

          <label className="block mb-4">
            <span className="block text-xs font-medium text-ink-600 mb-1.5">Username</span>
            <input
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-700/10"
              placeholder="admin"
            />
          </label>

          <label className="block mb-6">
            <span className="block text-xs font-medium text-ink-600 mb-1.5">Password</span>
            <PasswordInput
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-brass-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brass-600 disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
          <button type="button" onClick={() => { setMode("request"); setError(""); }} className="mt-4 w-full text-sm text-ink-600 underline underline-offset-2 hover:text-ink-950">
            Forgot password?
          </button>
        </form>}

        {mode === "request" && <form onSubmit={requestCode} className="bg-paper-50 rounded-lg p-7 shadow-2xl shadow-black/30">
          <h2 className="font-display text-lg text-ink-950 mb-2">Reset password</h2>
          <p className="mb-5 text-sm text-ink-600">Enter your account email. We will send a six-digit code through Gmail.</p>
          {error && <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">{error}</div>}
          <Field label="Account email" required><TextInput type="email" required autoComplete="email" value={resetForm.email} onChange={(event) => setResetForm({ ...resetForm, email: event.target.value })} /></Field>
          <button type="submit" disabled={submitting} className="w-full rounded-md bg-brass-500 py-2.5 text-sm font-medium text-white disabled:opacity-60">{submitting ? "Sending…" : "Send reset code"}</button>
          <button type="button" onClick={showLogin} className="mt-4 w-full text-sm text-ink-600 underline underline-offset-2 hover:text-ink-950">Back to sign in</button>
        </form>}

        {mode === "reset" && <form onSubmit={submitReset} className="bg-paper-50 rounded-lg p-7 shadow-2xl shadow-black/30">
          <h2 className="font-display text-lg text-ink-950 mb-2">Enter reset code</h2>
          <p className="mb-5 text-sm text-ink-600">Check your Gmail. The code expires in 10 minutes.</p>
          {error && <div className="mb-4 rounded-md border border-brick-600/30 bg-brick-100 px-3 py-2 text-sm text-brick-600">{error}</div>}
          <Field label="Account email" required><TextInput type="email" required value={resetForm.email} onChange={(event) => setResetForm({ ...resetForm, email: event.target.value })} /></Field>
          <Field label="Six-digit code" required><TextInput required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={resetForm.code} onChange={(event) => setResetForm({ ...resetForm, code: event.target.value.replace(/\D/g, "").slice(0, 6) })} /></Field>
          <Field label="New password" required><PasswordInput required minLength={12} maxLength={72} autoComplete="new-password" value={resetForm.newPassword} onChange={(event) => setResetForm({ ...resetForm, newPassword: event.target.value })} /></Field>
          <Field label="Confirm new password" required><PasswordInput required minLength={12} maxLength={72} autoComplete="new-password" value={resetForm.confirmPassword} onChange={(event) => setResetForm({ ...resetForm, confirmPassword: event.target.value })} /></Field>
          <button type="submit" disabled={submitting} className="w-full rounded-md bg-brass-500 py-2.5 text-sm font-medium text-white disabled:opacity-60">{submitting ? "Resetting…" : "Reset password"}</button>
          <button type="button" onClick={showLogin} className="mt-4 w-full text-sm text-ink-600 underline underline-offset-2 hover:text-ink-950">Back to sign in</button>
        </form>}

        <p className="text-center text-ink-500 text-xs mt-6">
          Locked out after 5 failed attempts for 15 minutes.
        </p>
      </div>
    </div>
  );
}
