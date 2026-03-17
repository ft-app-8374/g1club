"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="w-full bg-red-50 text-loss font-semibold py-3 rounded-card hover:bg-red-100 transition border border-red-200"
    >
      Log Out
    </button>
  );
}
