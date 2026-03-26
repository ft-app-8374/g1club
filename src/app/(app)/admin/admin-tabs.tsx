"use client";

import { useState, ReactNode } from "react";

interface AdminTabsProps {
  membersContent: ReactNode;
  racesContent: ReactNode;
  resultsContent: ReactNode;
  feedContent: ReactNode;
  memberCount: number;
  raceCount: number;
}

export function AdminTabs({ membersContent, racesContent, resultsContent, feedContent, memberCount, raceCount }: AdminTabsProps) {
  const [tab, setTab] = useState<"races" | "results" | "members" | "feed">("races");

  const tabs = [
    { id: "races" as const, label: "Races", badge: raceCount },
    { id: "results" as const, label: "Results", badge: null },
    { id: "feed" as const, label: "News", badge: null },
    { id: "members" as const, label: "Members", badge: memberCount },
  ];

  return (
    <div>
      <div className="flex border-b border-surface-muted mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === t.id
                ? "border-gold text-gold"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
            {t.badge !== null && (
              <span className="ml-1.5 text-xs text-slate-400">({t.badge})</span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-card p-5 border border-surface-muted shadow-card">
        {tab === "races" && racesContent}
        {tab === "results" && resultsContent}
        {tab === "feed" && feedContent}
        {tab === "members" && membersContent}
      </div>
    </div>
  );
}
