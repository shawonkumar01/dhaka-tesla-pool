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

interface Ride {
  id: string;
  pickupZone: string;
  destinationZone: string;
  seats: number;
  status: string;
  finalFare: number;
  poolId: string | null;
  createdAt: string;
}

export default function PassengerDashboard() {
  const [pickupZone, setPickupZone] = useState(ZONES[0]);
  const [destinationZone, setDestinationZone] = useState(ZONES[1]);
  const [seats, setSeats] = useState(1);
  const [rides, setRides] = useState<Ride[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function fetchRides() {
    const res = await api.get("/rides");
    setRides(res.data.rides);
  }

  useEffect(() => {
    fetchRides();
    const interval = setInterval(fetchRides, 4000); // simple polling for status updates
    return () => clearInterval(interval);
  }, []);

  async function handleRequestRide(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/rides", { pickupZone, destinationZone, seats });
      await fetchRides();
    } catch (err: any) {
      setError(
        err.response?.data?.error?.formErrors?.[0] ||
          err.response?.data?.error ||
          "Request failed",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    try {
      await api.post(`/rides/${id}/cancel`);
      await fetchRides();
    } catch (err: any) {
      setError(err.response?.data?.error || "Cancel failed");
    }
  }

  const statusColors: Record<string, string> = {
    REQUESTED: "bg-amber-100 text-amber-800",
    MATCHED: "bg-green-100 text-green-800",
    DRIVER_ARRIVED: "bg-blue-100 text-blue-800",
    STARTED: "bg-indigo-100 text-indigo-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="space-y-8">
      <section className="bg-white p-6 rounded-2xl shadow-sm">
        <h2 className="font-semibold text-lg mb-4">Request a ride</h2>
        <form onSubmit={handleRequestRide} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-500 block mb-1">Pickup</label>
              <select
                value={pickupZone}
                onChange={(e) => setPickupZone(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                {ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-500 block mb-1">
                Destination
              </label>
              <select
                value={destinationZone}
                onChange={(e) => setDestinationZone(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                {ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-500 block mb-1">Seats</label>
            <input
              type="number"
              min={1}
              max={3}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-black text-white rounded-lg py-2 font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {submitting ? "Requesting..." : "Request Ride"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-semibold text-lg mb-4">Your rides</h2>
        <div className="space-y-3">
          {rides.length === 0 && (
            <p className="text-gray-400 text-sm">No rides yet.</p>
          )}
          {rides.map((ride) => (
            <div
              key={ride.id}
              className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center"
            >
              <div>
                <p className="font-medium">
                  {ride.pickupZone} → {ride.destinationZone}
                </p>
                <p className="text-sm text-gray-500">
                  {ride.seats} seat(s) · ৳{(ride.finalFare / 100).toFixed(2)}
                  {ride.poolId && " · Pooled"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[ride.status]}`}
                >
                  {ride.status.replace("_", " ")}
                </span>
                {["REQUESTED", "MATCHED"].includes(ride.status) && (
                  <button
                    onClick={() => handleCancel(ride.id)}
                    className="text-xs text-red-500 underline"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
