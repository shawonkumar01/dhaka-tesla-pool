"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

const ZONES = [
  "Banani",
  "Gulshan 1",
  "Gulshan 2",
  "Mohakhali",
  "Dhanmondi",
  "Mirpur",
  "Uttara",
  "Farmgate",
  "Bashundhara",
];

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
  currentZone: string | null;
  pools: Pool[];
}

const NEXT_LABEL: Record<string, string> = {
  MATCHED: "Mark Driver Arrived",
  DRIVER_ARRIVED: "Start Trip",
  STARTED: "Complete Trip",
};

export default function DriverDashboard() {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [zone, setZone] = useState(ZONES[0]);

  const [vehicleName, setVehicleName] = useState("");
  const [capacity, setCapacity] = useState(3);

  async function fetchStatus() {
    try {
      const res = await api.get("/driver/me");
      setVehicle(res.data.vehicle);
      setNotFound(false);
      if (res.data.vehicle?.currentZone) {
        setZone(res.data.vehicle.currentZone);
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setNotFound(true);
      } else {
        setError(err.response?.data?.error || "Failed to load vehicle status");
      }
    }
  }

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  async function handleRegisterVehicle(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/driver/vehicle", { name: vehicleName, capacity });
      await fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to register vehicle");
    }
  }

  async function toggleOnline() {
    if (!vehicle) return;
    setBusy(true);
    setError("");
    try {
      await api.patch("/driver/status", {
        isOnline: !vehicle.isOnline,
        currentZone: zone,
      });
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

  // --- No vehicle registered yet: show registration form ---
  if (notFound) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm max-w-sm">
        <h2 className="font-semibold text-lg mb-3">Register your vehicle</h2>
        <form onSubmit={handleRegisterVehicle} className="space-y-3">
          <input
            type="text"
            placeholder="Vehicle name (e.g. Bullet)"
            value={vehicleName}
            onChange={(e) => setVehicleName(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          <input
            type="number"
            min={1}
            max={4}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-green-600 text-white rounded-xl py-3 font-medium text-sm hover:bg-green-700"
          >
            Register Vehicle
          </button>
        </form>
      </div>
    );
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
          {vehicle.currentZone && (
            <p className="text-xs text-gray-400 mt-1">
              Currently in: {vehicle.currentZone}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!vehicle.isOnline && (
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-2 text-sm"
            >
              {ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          )}
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
        </div>
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
