"use client";

import { useSession, signOut } from "next-auth/react";

export default function ProfilePage() {
  const { data: session } = useSession();

  if (!session) return null;

  return (
    <div className="space-y-6">
      <div className="text-center py-6">
        <div className="w-20 h-20 bg-gold-accent rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-3xl text-gold font-bold">
            {session.user.username[0].toUpperCase()}
          </span>
        </div>
        <h2 className="text-xl font-bold text-slate-900">{session.user.username}</h2>
        <p className="text-sm text-slate-500">{session.user.email}</p>
        {session.user.role === "admin" && (
          <span className="inline-block mt-2 text-xs bg-gold-accent text-gold px-3 py-1 rounded-full font-medium">
            Admin
          </span>
        )}
      </div>

      <div className="bg-white rounded-card p-5 border border-surface-muted shadow-card">
        <h3 className="text-sm font-bold text-gold mb-3 uppercase tracking-wide">
          Account
        </h3>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex justify-between">
            <span>Username</span>
            <span className="text-slate-900">{session.user.username}</span>
          </div>
          <div className="flex justify-between">
            <span>Email</span>
            <span className="text-slate-900">{session.user.email}</span>
          </div>
          <div className="flex justify-between">
            <span>Role</span>
            <span className="capitalize text-slate-900">{session.user.role}</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="w-full bg-red-50 text-loss font-semibold py-3 rounded-card hover:bg-red-100 transition border border-red-200"
      >
        Log Out
      </button>
    </div>
  );
}
