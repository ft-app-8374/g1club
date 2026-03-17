"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/races", label: "Races", icon: "🏇" },
  { href: "/leaderboard", label: "Leaderboard", icon: "🏆" },
  { href: "/honour-roll", label: "Honour Roll", icon: "📜" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

export function AppHeader({
  isAdmin,
  username,
}: {
  isAdmin: boolean;
  username: string;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Prevent scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const allItems = isAdmin
    ? [...menuItems, { href: "/admin", label: "Admin", icon: "⚙️" }]
    : menuItems;

  return (
    <>
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-surface-muted h-14 flex items-center px-4">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
          {/* Left: hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-10 h-10 flex items-center justify-center text-slate-600 hover:text-slate-900 -ml-2"
            aria-label="Open menu"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Center: title */}
          <h1 className="text-lg font-bold text-slate-900">
            Group 1 <span className="text-gold">Club</span>
          </h1>

          {/* Right: avatar */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gold-accent flex items-center justify-center">
              <span className="text-sm font-bold text-gold">
                {username[0]?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Drawer Overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 drawer-overlay"
          onClick={() => setDrawerOpen(false)}
        >
          {/* Drawer Panel */}
          <nav
            className="absolute top-0 left-0 bottom-0 w-72 bg-white shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-600 px-5 py-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold text-lg">
                  Group 1 <span className="text-gold">Club</span>
                </h2>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="text-white/70 hover:text-white"
                  aria-label="Close menu"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-white font-bold">
                    {username[0]?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{username}</p>
                  {isAdmin && (
                    <span className="text-xs text-gold">Admin</span>
                  )}
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="flex-1 py-2 overflow-y-auto">
              {allItems.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-5 py-3 text-sm font-medium transition ${
                      active
                        ? "text-gold bg-gold-accent border-r-3 border-gold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-surface"
                    }`}
                  >
                    <span className="text-lg w-7 text-center">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* Drawer Footer */}
            <div className="border-t border-surface-muted px-5 py-3">
              <p className="text-xs text-slate-400">
                Group 1 Club &middot; Est. 2015
              </p>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

// Keep the old export name for backward compat during transition
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  return null;
}
