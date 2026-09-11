import { X } from "lucide-react";
import { useEffect } from "react";

export default function Modal({ open, onClose, title, children, width = "max-w-md" }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto px-4 py-10">
      <div className="fixed inset-0 bg-ink-950/40" onClick={onClose} />
      <div className={`relative z-10 w-full ${width} rounded-lg bg-paper-50 shadow-2xl shadow-ink-950/20`}>
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="font-display text-lg text-ink-950">{title}</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-900" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
