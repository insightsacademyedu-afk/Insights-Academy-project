import { useState } from "react";
import { ChevronDown, LogOut, Menu } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Topbar({ title, onOpenMobileNav }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex items-center justify-between border-b border-ink-200 bg-paper-50 px-4 md:px-8 py-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileNav}
          className="md:hidden text-ink-700 -ml-1 p-1"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <h1 className="font-display text-xl md:text-2xl text-ink-950">{title}</h1>
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-md border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-800 hover:border-ink-300"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 text-[11px] font-medium text-paper-50">
            {(user?.username || "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden sm:inline">{user?.username}</span>
          <span className="hidden sm:inline text-[11px] uppercase text-ink-500 tracking-wide">
            {user?.role}
          </span>
          <ChevronDown size={14} />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 z-20 mt-2 w-44 rounded-md border border-ink-200 bg-white py-1 shadow-lg shadow-ink-950/5">
              <div className="px-3 py-2 border-b border-ink-100">
                <div className="text-sm text-ink-900">{user?.email}</div>
              </div>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-brick-600 hover:bg-brick-100/60"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
