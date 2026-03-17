"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/races", label: "Races", icon: "📋" },
  { href: "/leaderboard", label: "Board", icon: "🏆" },
  { href: "/honour-roll", label: "Roll", icon: "📜" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const allTabs = isAdmin
    ? [...tabs, { href: "/admin", label: "Admin", icon: "⚙️" }]
    : tabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-navy-card border-t border-navy-border">
      <div className="max-w-5xl mx-auto flex justify-around">
        {allTabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center py-2 px-3 text-xs transition ${
                active ? "text-gold" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <span className="text-lg mb-0.5">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
