"use client";

import { useState, useEffect } from "react";

interface CountdownProps {
  cutoffAt: string;
  untippedCount: number;
  roundName: string;
  venue?: string;
}

export function Countdown({ cutoffAt, untippedCount, roundName, venue }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(cutoffAt));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeLeft(cutoffAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [cutoffAt]);

  if (timeLeft.total <= 0) {
    return (
      <div className="bg-loss/20 border-2 border-loss/50 rounded-xl p-5 text-center">
        <p className="text-loss font-bold text-lg">Tips Closed</p>
        <p className="text-sm text-slate-400 mt-1">{roundName}</p>
      </div>
    );
  }

  const isUrgent = timeLeft.total < 3 * 60 * 60 * 1000; // < 3 hours
  const isCritical = timeLeft.total < 60 * 60 * 1000; // < 1 hour

  const borderColor = isCritical
    ? "border-loss animate-pulse"
    : isUrgent
      ? "border-orange-500"
      : "border-gold/50";

  const bgColor = isCritical
    ? "bg-loss/20"
    : isUrgent
      ? "bg-orange-500/10"
      : "bg-gold/10";

  return (
    <div className={`${bgColor} border-2 ${borderColor} rounded-xl p-5`}>
      {untippedCount > 0 && (
        <div className="text-center mb-3">
          <p className={`text-sm font-bold ${isCritical ? "text-loss" : isUrgent ? "text-orange-400" : "text-gold"}`}>
            {isCritical
              ? "TIPS CLOSING SOON!"
              : isUrgent
                ? "Don't forget to tip!"
                : "Tips open"}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {untippedCount} race{untippedCount !== 1 ? "s" : ""} need{untippedCount === 1 ? "s" : ""} your tips — {roundName}{venue ? ` (${venue})` : ""}
          </p>
        </div>
      )}

      <div className="flex justify-center gap-3">
        <TimeBlock value={timeLeft.days} label="days" show={timeLeft.days > 0} />
        <TimeBlock value={timeLeft.hours} label="hrs" show={true} />
        <TimeBlock value={timeLeft.minutes} label="min" show={true} />
        <TimeBlock value={timeLeft.seconds} label="sec" show={true} />
      </div>

      {untippedCount > 0 && (
        <div className="text-center mt-3">
          <a
            href="/races"
            className={`inline-block font-bold text-sm px-5 py-2 rounded-lg transition ${
              isCritical
                ? "bg-loss text-white hover:bg-red-600"
                : isUrgent
                  ? "bg-orange-500 text-white hover:bg-orange-600"
                  : "bg-gold text-navy hover:bg-gold-dark"
            }`}
          >
            Submit Tips Now
          </a>
        </div>
      )}
    </div>
  );
}

function TimeBlock({ value, label, show }: { value: number; label: string; show: boolean }) {
  if (!show) return null;
  return (
    <div className="text-center">
      <div className="bg-navy-card border border-navy-border rounded-lg px-3 py-2 min-w-[3.5rem]">
        <span className="text-2xl font-bold font-mono text-white">
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className="text-xs text-slate-500 mt-1 block">{label}</span>
    </div>
  );
}

function getTimeLeft(cutoffAt: string) {
  const now = Date.now();
  const cutoff = new Date(cutoffAt).getTime();
  const total = Math.max(0, cutoff - now);

  return {
    total,
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
  };
}
