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
  paid: boolean;
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

interface PastRide {
  id: string;
  passenger: { name: string };
  finalFare: number;
  status: string;
  paid: boolean;
}
interface PastPool {
  id: string;
  status: string;
  seatsUsed: number;
  createdAt: string;
  completedAt: string | null;
  rideRequests: PastRide[];
}

const NEXT_LABEL: Record<string, string> = {
  MATCHED: "Accept Pool",
  ACCEPTED: "Mark Driver Arrived",
  DRIVER_ARRIVED: "Start Trip",
  STARTED: "End Trip",
  AWAITING_PAYMENT: "Complete Trip",
};

const STAGE_LABEL: Record<string, string> = {
  MATCHED: "Awaiting your response",
  ACCEPTED: "Accepted",
  DRIVER_ARRIVED: "Arrived at pickup",
  STARTED: "Trip in progress",
  AWAITING_PAYMENT: "Trip ended — awaiting payment",
};

export default function DriverDashboard() {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [zone, setZone] = useState(ZONES[0]);

  const [vehicleName, setVehicleName] = useState("");
  const [capacity, setCapacity] = useState(3);

  const [history, setHistory] = useState<PastPool[]>([]);
  const [showHistory, setShowHistory] = useState(false);

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

  async function fetchHistory() {
    try {
      const res = await api.get("/driver/history");
      setHistory(res.data.pools);
    } catch {
      // non-critical
    }
  }

  useEffect(() => {
    fetchStatus();
    fetchHistory();
    const interval = setInterval(() => {
      fetchStatus();
      fetchHistory();
    }, 4000);
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
    setError("");
    try {
      await api.post(`/driver/pools/${poolId}/advance`);
      await fetchStatus();
      await fetchHistory();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to advance ride");
    } finally {
      setBusy(false);
    }
  }

  async function declinePool(poolId: string) {
    setBusy(true);
    setError("");
    try {
      await api.post(`/driver/pools/${poolId}/decline`);
      await fetchStatus();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to decline pool");
    } finally {
      setBusy(false);
    }
  }

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

  const activePool = vehicle.pools[0];
  const currentStatus = activePool?.rideRequests[0]?.status;
  const allPaid =
    currentStatus === "AWAITING_PAYMENT"
      ? activePool!.rideRequests.every((r) => r.paid)
      : true;

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
          <p className="text-gray-400 text-sm">
            {vehicle.isOnline
              ? "No active pool right now. Waiting for requests in your zone."
              : "You are offline. Go online to receive requests."}
          </p>
        )}

        {activePool && (
          <div className="bg-white p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex justify-between items-center gap-3">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {activePool.seatsUsed}/{vehicle.capacity} seats
                </p>
                {currentStatus && (
                  <p className="text-xs text-gray-400">
                    {STAGE_LABEL[currentStatus] ?? currentStatus}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                {currentStatus === "MATCHED" && (
                  <button
                    onClick={() => declinePool(activePool.id)}
                    disabled={busy}
                    className="text-sm px-4 py-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50"
                  >
                    Decline
                  </button>
                )}
                {currentStatus && NEXT_LABEL[currentStatus] && (
                  <button
                    onClick={() => advancePool(activePool.id)}
                    disabled={
                      busy || (currentStatus === "AWAITING_PAYMENT" && !allPaid)
                    }
                    title={
                      currentStatus === "AWAITING_PAYMENT" && !allPaid
                        ? "Waiting for all riders to pay"
                        : undefined
                    }
                    className="bg-green-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {NEXT_LABEL[currentStatus]}
                  </button>
                )}
              </div>
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
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      ৳{(r.finalFare / 100).toFixed(2)}
                    </p>
                    {currentStatus === "AWAITING_PAYMENT" && (
                      <p
                        className={`text-xs ${
                          r.paid ? "text-green-600" : "text-amber-600"
                        }`}
                      >
                        {r.paid ? "Paid" : "Unpaid"}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <button
          onClick={() => setShowHistory((s) => !s)}
          className="text-sm font-medium text-gray-500 underline mb-3"
        >
          {showHistory ? "Hide" : "Show"} ride history ({history.length})
        </button>

        {showHistory && (
          <div className="space-y-3">
            {history.length === 0 && (
              <p className="text-gray-400 text-sm">No past trips yet.</p>
            )}
            {history.map((pool) => (
              <div key={pool.id} className="bg-white p-4 rounded-xl shadow-sm">
                <div className="flex justify-between text-sm text-gray-500 mb-2">
                  <span>{pool.status}</span>
                  <span>{new Date(pool.createdAt).toLocaleString()}</span>
                </div>
                <div className="divide-y">
                  {pool.rideRequests.map((r) => (
                    <div
                      key={r.id}
                      className="py-2 flex justify-between items-center text-sm"
                    >
                      <span>{r.passenger.name}</span>
                      <span className="flex items-center gap-2">
                        ৳{(r.finalFare / 100).toFixed(2)}
                        {r.paid ? (
                          <span className="text-green-600 text-xs font-medium">
                            Paid
                          </span>
                        ) : (
                          <span className="text-amber-600 text-xs font-medium">
                            Unpaid
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
