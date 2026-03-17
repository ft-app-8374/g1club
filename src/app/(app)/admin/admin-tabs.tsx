"use client";

import { useState, ReactNode } from "react";

interface AdminTabsProps {
  membersContent: ReactNode;
  racesContent: ReactNode;
  resultsContent: ReactNode;
  memberCount: number;
  raceCount: number;
}

export function AdminTabs({ membersContent, racesContent, resultsContent, memberCount, raceCount }: AdminTabsProps) {
  const [tab, setTab] = useState<"races" | "results" | "members">("races");

  const tabs = [
    { id: "races" as const, label: "Races", badge: raceCount },
    { id: "results" as const, label: "Results", badge: null },
    { id: "members" as const, label: "Members", badge: memberCount },
  ];

  return (
    <div>
      <div className="flex border-b border-navy-border mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === t.id
                ? "border-gold text-gold"
                : "border-transparent text-slate-400 hover:text-slate-300"
            }`}
          >
            {t.label}
            {t.badge !== null && (
              <span className="ml-1.5 text-xs text-slate-500">({t.badge})</span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-navy-card rounded-xl p-5 border border-navy-border">
        {tab === "races" && racesContent}
        {tab === "results" && resultsContent}
        {tab === "members" && membersContent}
      </div>
    </div>
  );
}
