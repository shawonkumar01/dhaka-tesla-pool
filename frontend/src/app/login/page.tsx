"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-gray-50 px-4">
      <div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-green-600 text-white text-xl font-bold mb-3">
            T
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Dhaka Tesla Pool</h1>
          <p className="text-sm text-gray-500 mt-1">
            Share a seat. Split the fare.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent transition"
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white rounded-xl py-3 font-medium text-sm hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="text-sm text-center mt-5 text-gray-500">
          No account?{" "}
          <Link
            href="/signup"
            className="text-green-600 font-medium hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
