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
    <div className="bg-navy-card rounded-xl p-5 border border-navy-border">
      <h3 className="text-sm font-bold text-gold mb-4 uppercase tracking-wide">
        All Tips (Locked)
      </h3>
      <div className="space-y-3">
        {tips.map((tip) => (
          <div
            key={tip.username}
            className="bg-navy-light rounded-lg p-3 border border-navy-border"
          >
            <p className="font-semibold text-sm mb-2">{tip.username}</p>
            <div className="space-y-1">
              {tip.lines.map((l, i) => (
                <div key={i} className="text-xs text-slate-300">
                  ${l.amount} {l.betType.toUpperCase()} {l.runnerName}
                  {l.backupName && (
                    <span className="text-slate-500">
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
