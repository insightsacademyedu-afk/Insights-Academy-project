export default function Button({ variant = "primary", className = "", children, ...props }) {
  const variants = {
    primary: "bg-brass-500 text-white hover:bg-brass-600 disabled:opacity-60",
    ghost: "border border-ink-200 text-ink-700 hover:border-ink-300 bg-white disabled:opacity-60",
    danger: "bg-brick-600 text-white hover:bg-brick-600/90 disabled:opacity-60",
  };

  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
