"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

interface RideRequest {
  id: string;
  pickupZone: string;
  destinationZone: string;
  seats: number;
  status: string;
  finalFare: number;
  passenger: { id: string; name: string; email: string };
}

interface Pool {
  id: string;
  status: string;
  seatsUsed: number;
  rideRequests: RideRequest[];
}

interface Vehicle {
  id: string;
  name: string;
  capacity: number;
  isOnline: boolean;
  pools: Pool[];
}

const NEXT_LABEL: Record<string, string> = {
  MATCHED: "Mark Driver Arrived",
  DRIVER_ARRIVED: "Start Trip",
  STARTED: "Complete Trip",
};

export default function DriverDashboard() {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function fetchStatus() {
    try {
      const res = await api.get("/driver/me");
      setVehicle(res.data.vehicle);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load vehicle status");
    }
  }

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  async function toggleOnline() {
    if (!vehicle) return;
    setBusy(true);
    try {
      await api.patch("/driver/status", { isOnline: !vehicle.isOnline });
      await fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update status");
    } finally {
      setBusy(false);
    }
  }

  async function advancePool(poolId: string) {
    setBusy(true);
    try {
      await api.post(`/driver/pools/${poolId}/advance`);
      await fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to advance ride");
    } finally {
      setBusy(false);
    }
  }

  if (!vehicle) {
    return (
      <p className="text-gray-400 text-sm">{error || "Loading vehicle..."}</p>
    );
  }

  const activePool = vehicle.pools[0]; // one active pool at a time, by design
  const currentStatus = activePool?.rideRequests[0]?.status;

  return (
    <div className="space-y-8">
      <section className="bg-white p-6 rounded-2xl shadow-sm flex justify-between items-center">
        <div>
          <h2 className="font-semibold text-lg">{vehicle.name}</h2>
          <p className="text-sm text-gray-500">
            Capacity: {vehicle.capacity} seats
          </p>
        </div>
        <button
          onClick={toggleOnline}
          disabled={busy}
          className={`px-4 py-2 rounded-lg font-medium text-sm ${
            vehicle.isOnline
              ? "bg-green-600 text-white"
              : "bg-gray-200 text-gray-700"
          } disabled:opacity-50`}
        >
          {vehicle.isOnline ? "Online" : "Go Online"}
        </button>
      </section>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <section>
        <h2 className="font-semibold text-lg mb-4">Current pool</h2>
        {!activePool && (
          <p className="text-gray-400 text-sm">No active pool right now.</p>
        )}

        {activePool && (
          <div className="bg-white p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-500">
                {activePool.seatsUsed}/{vehicle.capacity} seats ·{" "}
                {activePool.status}
              </span>
              {currentStatus && NEXT_LABEL[currentStatus] && (
                <button
                  onClick={() => advancePool(activePool.id)}
                  disabled={busy}
                  className="bg-black text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  {NEXT_LABEL[currentStatus]}
                </button>
              )}
            </div>

            <div className="divide-y">
              {activePool.rideRequests.map((r) => (
                <div
                  key={r.id}
                  className="py-3 flex justify-between items-center"
                >
                  <div>
                    <p className="font-medium">{r.passenger.name}</p>
                    <p className="text-sm text-gray-500">
                      {r.pickupZone} → {r.destinationZone}
                    </p>
                  </div>
                  <p className="text-sm font-medium">
                    ৳{(r.finalFare / 100).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
