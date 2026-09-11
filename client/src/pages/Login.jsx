import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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

        <form onSubmit={handleSubmit} className="bg-paper-50 rounded-lg p-7 shadow-2xl shadow-black/30">
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
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-700/10"
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
        </form>

        <p className="text-center text-ink-500 text-xs mt-6">
          Locked out after 5 failed attempts for 15 minutes.
        </p>
      </div>
    </div>
  );
}
