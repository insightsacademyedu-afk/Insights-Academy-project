import { NavLink } from "react-router-dom";
import { Lock } from "lucide-react";
import { NAV_SECTIONS, CURRENT_PHASE } from "../lib/nav";
import { useAuth } from "../context/AuthContext";
import { useAcademy } from "../context/academy";

export default function Sidebar() {
  const { user } = useAuth();
  const { settings } = useAcademy();

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col bg-ink-950 text-paper-100">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-ink-800">
        <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0">
          <path
            d="M16 6 L26 11 V16 C26 22 21.5 25.8 16 27 C10.5 25.8 6 22 6 16 V11 Z"
            fill="none"
            stroke="#C7952F"
            strokeWidth="1.6"
          />
          <line x1="16" y1="10" x2="16" y2="22" stroke="#C7952F" strokeWidth="1.2" />
          <line x1="11" y1="13" x2="21" y2="13" stroke="#C7952F" strokeWidth="1.2" />
        </svg>
        <div>
          <div className="font-display text-lg leading-tight">Ledger</div>
          <div className="max-w-40 truncate text-[11px] text-ink-300 leading-tight" title={settings.academyName}>{settings.academyName}</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
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
                        title={`Coming in build phase ${item.phase}`}
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
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                          isActive
                            ? "bg-ink-800 text-paper-50"
                            : "text-ink-200 hover:bg-ink-900 hover:text-paper-50"
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

      <div className="px-6 py-4 border-t border-ink-800 text-[11px] text-ink-500">
        {settings.academyPhone || settings.academyName}
      </div>
    </aside>
  );
}
