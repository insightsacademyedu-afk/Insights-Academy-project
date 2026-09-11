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
