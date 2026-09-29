"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  if (loading || user) {
    return null; // avoid a flash of the landing page for already-logged-in users
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-600 text-white text-2xl font-bold mb-4">
          T
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Dhaka Tesla Pool</h1>
        <p className="text-sm text-gray-500 mt-2 mb-8">
          Share a seat. Split the fare. Survive Dhaka traffic.
        </p>

        <div className="space-y-3">
          <Link
            href="/login"
            className="block w-full bg-green-600 text-white rounded-xl py-3 font-medium text-sm hover:bg-green-700 transition"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="block w-full bg-white border border-gray-200 text-gray-700 rounded-xl py-3 font-medium text-sm hover:border-green-300 transition"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
