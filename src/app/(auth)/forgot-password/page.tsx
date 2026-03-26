"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Group 1 <span className="text-gold">Club</span>
          </h1>
        </div>

        <div className="bg-white rounded-card p-6 border border-surface-muted shadow-card">
          {sent ? (
            <div className="text-center">
              <h2 className="text-lg font-bold text-slate-900 mb-2">Check your email</h2>
              <p className="text-sm text-slate-500 mb-4">
                If that email is registered, we&apos;ve sent a password reset link. It expires in 1 hour.
              </p>
              <Link
                href="/login"
                className="text-gold hover:text-gold-dark font-medium text-sm"
              >
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Reset your password</h2>
              <p className="text-sm text-slate-500 mb-4">
                Enter your email and we&apos;ll send you a reset link.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm text-slate-600 mb-1 font-medium">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-surface-muted rounded-lg px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gold hover:bg-gold-dark text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>

              <p className="text-center text-sm text-slate-500 mt-4">
                <Link href="/login" className="text-gold hover:text-gold-dark font-medium">
                  Back to login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
