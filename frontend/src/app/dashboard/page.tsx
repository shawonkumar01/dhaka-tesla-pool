"use client";

import { useAuth } from "@/context/AuthContext";
import PassengerDashboard from "@/components/PassengerDashboard";
import DriverDashboard from "@/components/DriverDashboard";

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-600 text-white flex items-center justify-center font-bold text-sm">
            T
          </div>
          <div>
            <h1 className="font-bold text-gray-900 leading-tight">
              Dhaka Tesla Pool
            </h1>
            <p className="text-xs text-gray-500">
              {user.name} · {user.role === "PASSENGER" ? "Passenger" : "Driver"}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-400 hover:text-red-500 transition"
        >
          Log out
        </button>
      </header>
      <main className="max-w-2xl mx-auto p-6 space-y-8">
        {user.role === "PASSENGER" ? (
          <PassengerDashboard />
        ) : (
          <DriverDashboard />
        )}
      </main>
    </div>
  );
}
