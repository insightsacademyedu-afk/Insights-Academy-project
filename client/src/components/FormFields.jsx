import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function Field({ label, error, children, required }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-medium text-ink-600 mb-1.5">
        {label}
        {required && <span className="text-brick-600"> *</span>}
      </span>
      {children}
      {error && <span className="block text-xs text-brick-600 mt-1">{error}</span>}
    </label>
  );
}

const baseInputClasses =
  "w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-700/10 disabled:bg-paper-200 disabled:text-ink-500";

export function TextInput(props) {
  return <input className={baseInputClasses} {...props} />;
}

export function PasswordInput({ className = "", ...props }) {
  const [visible, setVisible] = useState(false);
  const label = visible ? "Hide password" : "Show password";

  return (
    <span className="relative block">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`${baseInputClasses} pr-10 ${className}`}
      />
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => setVisible((value) => !value)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-500 hover:text-ink-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ink-700/20"
      >
        {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>
    </span>
  );
}

export function TextArea(props) {
  return <textarea className={`${baseInputClasses} min-h-20`} {...props} />;
}

export function Select({ children, ...props }) {
  return (
    <select className={baseInputClasses} {...props}>
      {children}
    </select>
  );
}
