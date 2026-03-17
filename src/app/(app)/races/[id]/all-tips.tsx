"use client";

interface TipDisplay {
  username: string;
  lines: Array<{
    betType: string;
    amount: number;
    runnerName: string;
    backupName?: string;
  }>;
}

export function AllTips({ tips }: { tips: TipDisplay[] }) {
  return (
    <div className="bg-white rounded-card p-5 border border-surface-muted shadow-card">
      <h3 className="text-sm font-bold text-gold mb-4 uppercase tracking-wide">
        All Tips (Locked)
      </h3>
      <div className="space-y-3">
        {tips.map((tip) => (
          <div
            key={tip.username}
            className="bg-surface rounded-lg p-3 border border-surface-muted"
          >
            <p className="font-semibold text-sm text-slate-900 mb-2">{tip.username}</p>
            <div className="space-y-1">
              {tip.lines.map((l, i) => (
                <div key={i} className="text-xs text-slate-600">
                  ${l.amount} {l.betType.toUpperCase()} {l.runnerName}
                  {l.backupName && (
                    <span className="text-slate-400">
                      {" "}
                      (backup: {l.backupName})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
