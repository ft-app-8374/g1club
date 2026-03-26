"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="text-lg font-bold text-slate-900 mb-2">Invalid Reset Link</h2>
        <p className="text-sm text-slate-500 mb-4">
          This link is missing or invalid. Please request a new one.
        </p>
        <Link href="/forgot-password" className="text-gold hover:text-gold-dark font-medium text-sm">
          Request new reset link
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setSuccess(true);
    } else {
      setError(data.error || "Something went wrong");
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <h2 className="text-lg font-bold text-slate-900 mb-2">Password Reset!</h2>
        <p className="text-sm text-slate-500 mb-4">
          Your password has been updated. You can now log in.
        </p>
        <Link
          href="/login"
          className="inline-block bg-gold hover:bg-gold-dark text-white font-bold py-3 px-8 rounded-lg transition"
        >
          Log In
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-lg font-bold text-slate-900 mb-1">Choose a new password</h2>
      <p className="text-sm text-slate-500 mb-4">Must be at least 6 characters.</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-loss rounded-lg px-4 py-2 mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm text-slate-600 mb-1 font-medium">
            New Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white border border-surface-muted rounded-lg px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition"
            placeholder="Enter new password"
            required
            minLength={6}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm text-slate-600 mb-1 font-medium">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full bg-white border border-surface-muted rounded-lg px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 transition"
            placeholder="Confirm new password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gold hover:bg-gold-dark text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Group 1 <span className="text-gold">Club</span>
          </h1>
        </div>

        <div className="bg-white rounded-card p-6 border border-surface-muted shadow-card">
          <Suspense fallback={<div className="text-center text-slate-500">Loading...</div>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
