import { NavLink } from "react-router-dom";
import { X, Lock } from "lucide-react";
import { NAV_SECTIONS, CURRENT_PHASE } from "../lib/nav";
import { useAuth } from "../context/AuthContext";
import { useAcademy } from "../context/academy";

export default function MobileNav({ open, onClose }) {
  const { user } = useAuth();
  const { settings } = useAcademy();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 md:hidden">
      <div className="absolute inset-0 bg-ink-950/40" onClick={onClose} />
      <div className="absolute left-0 top-0 h-full w-72 bg-ink-950 text-paper-100 overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-5 border-b border-ink-800">
          <span className="max-w-56 truncate font-display text-lg">{settings.academyName}</span>
          <button onClick={onClose} aria-label="Close navigation">
            <X size={20} />
          </button>
        </div>
        <nav className="px-3 py-4 space-y-6">
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter((item) => !item.adminOnly || user?.role === "admin");
            if (!items.length) return null;
            return (
              <div key={section.label}>
                <div className="px-3 mb-2 text-[11px] font-medium text-ink-500 tracking-wide">
                  {section.label}
                </div>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const enabled = item.phase <= CURRENT_PHASE;
                    const Icon = item.icon;
                    if (!enabled) {
                      return (
                        <div
                          key={item.to}
                          className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-ink-500"
                        >
                          <span className="flex items-center gap-2.5">
                            <Icon size={16} strokeWidth={1.75} />
                            {item.label}
                          </span>
                          <Lock size={12} strokeWidth={2} />
                        </div>
                      );
                    }
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === "/"}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm ${
                            isActive ? "bg-ink-800 text-paper-50" : "text-ink-200"
                          }`
                        }
                      >
                        <Icon size={16} strokeWidth={1.75} />
                        {item.label}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
