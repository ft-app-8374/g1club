"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Invalid username or password");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gold mb-2">
            Group 1 Club
          </h1>
          <p className="text-slate-400 italic">
            &ldquo;Tipping winners since&hellip; never&rdquo;
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-navy-card rounded-xl p-6 border border-navy-border"
        >
          {error && (
            <div className="bg-loss/10 border border-loss/30 text-loss rounded-lg px-4 py-2 mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm text-slate-400 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-navy-light border border-navy-border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-gold transition"
              placeholder="e.g. Law"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm text-slate-400 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-navy-light border border-navy-border rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-gold transition"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold hover:bg-gold-dark text-navy font-bold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>

          <p className="text-center text-sm text-slate-400 mt-4">
            Have an invite code?{" "}
            <Link href="/register" className="text-gold hover:text-gold-light">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
