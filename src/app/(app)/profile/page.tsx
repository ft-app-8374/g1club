"use client";

import { useSession, signOut } from "next-auth/react";

export default function ProfilePage() {
  const { data: session } = useSession();

  if (!session) return null;

  return (
    <div className="space-y-6">
      <div className="text-center py-6">
        <div className="w-20 h-20 bg-gold/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-3xl text-gold font-bold">
            {session.user.username[0].toUpperCase()}
          </span>
        </div>
        <h2 className="text-xl font-bold">{session.user.username}</h2>
        <p className="text-sm text-slate-400">{session.user.email}</p>
        {session.user.role === "admin" && (
          <span className="inline-block mt-2 text-xs bg-gold/20 text-gold px-3 py-1 rounded-full">
            Admin
          </span>
        )}
      </div>

      <div className="bg-navy-card rounded-xl p-5 border border-navy-border">
        <h3 className="text-sm font-bold text-gold mb-3 uppercase tracking-wide">
          Account
        </h3>
        <div className="space-y-2 text-sm text-slate-300">
          <div className="flex justify-between">
            <span>Username</span>
            <span>{session.user.username}</span>
          </div>
          <div className="flex justify-between">
            <span>Email</span>
            <span>{session.user.email}</span>
          </div>
          <div className="flex justify-between">
            <span>Role</span>
            <span className="capitalize">{session.user.role}</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="w-full bg-loss/10 text-loss font-semibold py-3 rounded-xl hover:bg-loss/20 transition"
      >
        Log Out
      </button>
    </div>
  );
}
