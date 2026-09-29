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
  paid: boolean;
  paymentMethod: string;
}

interface Fare {
  baseFare: number;
  distanceCharge: number;
  poolDiscount: number;
  finalFare: number;
}

interface Estimate {
  distanceKm: number;
  solo: Fare;
  pooled: Fare;
}

const taka = (poysha: number) => `৳${(poysha / 100).toFixed(2)}`;

const statusColors: Record<string, string> = {
  REQUESTED: "bg-amber-100 text-amber-800",
  MATCHED: "bg-yellow-100 text-yellow-800",
  ACCEPTED: "bg-teal-100 text-teal-800",
  DRIVER_ARRIVED: "bg-blue-100 text-blue-800",
  STARTED: "bg-indigo-100 text-indigo-800",
  AWAITING_PAYMENT: "bg-orange-100 text-orange-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const statusLabels: Record<string, string> = {
  REQUESTED: "LOOKING FOR A DRIVER",
  MATCHED: "AWAITING DRIVER",
  ACCEPTED: "DRIVER ACCEPTED",
  DRIVER_ARRIVED: "DRIVER ARRIVED",
  STARTED: "IN PROGRESS",
  AWAITING_PAYMENT: "TRIP ENDED — PAYMENT DUE",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

const CANCELLABLE = ["REQUESTED", "MATCHED", "ACCEPTED", "DRIVER_ARRIVED"];

export default function PassengerDashboard() {
  const [pickupZone, setPickupZone] = useState(ZONES[0]);
  const [destinationZone, setDestinationZone] = useState(ZONES[1]);
  const [seats, setSeats] = useState(1);
  const [rides, setRides] = useState<Ride[]>([]);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function fetchRides() {
    try {
      const res = await api.get("/rides");
      setRides(res.data.rides);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load rides");
    }
  }

  useEffect(() => {
    fetchRides();
    const interval = setInterval(fetchRides, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/rides/estimate", {
        params: { pickupZone, destinationZone, seats },
      })
      .then((res) => {
        if (!cancelled) setEstimate(res.data);
      })
      .catch(() => {
        if (!cancelled) setEstimate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pickupZone, destinationZone, seats]);

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
          (typeof err.response?.data?.error === "string"
            ? err.response.data.error
            : "Request failed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    setError("");
    try {
      await api.post(`/rides/${id}/cancel`);
      await fetchRides();
    } catch (err: any) {
      setError(err.response?.data?.error || "Cancel failed");
    }
  }

  async function handlePay(id: string) {
    setError("");
    try {
      await api.post(`/rides/${id}/pay`);
      await fetchRides();
    } catch (err: any) {
      setError(err.response?.data?.error || "Payment failed");
    }
  }

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
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
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
                className="w-full border border-gray-200 rounded-lg px-3 py-2"
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
              onChange={(e) =>
                setSeats(Math.min(3, Math.max(1, Number(e.target.value) || 1)))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
            />
          </div>

          {estimate && (
            <div className="rounded-xl border border-green-100 bg-green-50 p-4 text-sm">
              <div className="flex justify-between items-baseline">
                <span className="text-gray-600">
                  Estimated fare · {estimate.distanceKm.toFixed(2)} km
                </span>
                <span className="text-lg font-semibold text-gray-900">
                  {taka(estimate.solo.finalFare)}
                </span>
              </div>
              <p className="mt-1 text-green-700">
                Share the ride and pay {taka(estimate.pooled.finalFare)} (save{" "}
                {taka(estimate.pooled.poolDiscount)})
              </p>
              <p className="mt-2 text-xs text-gray-400">
                Base {taka(estimate.solo.baseFare)} + distance{" "}
                {taka(estimate.solo.distanceCharge)}, minus 20% if pooled
              </p>
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-600 text-white rounded-lg py-2 font-medium hover:bg-green-700 disabled:opacity-50"
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
                  {ride.seats} seat(s) · {taka(ride.finalFare)}
                  {ride.poolId &&
                    !["CANCELLED", "COMPLETED"].includes(ride.status) &&
                    " · Pooled"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    statusColors[ride.status] ?? "bg-gray-100 text-gray-500"
                  }`}
                >
                  {statusLabels[ride.status] ?? ride.status}
                </span>

                {ride.status === "AWAITING_PAYMENT" &&
                  (ride.paid ? (
                    <span className="text-xs text-green-600 font-medium">
                      Paid · waiting for driver
                    </span>
                  ) : (
                    <button
                      onClick={() => handlePay(ride.id)}
                      className="text-xs bg-green-600 text-white px-3 py-1 rounded-full hover:bg-green-700"
                    >
                      Pay Now
                    </button>
                  ))}

                {ride.status === "COMPLETED" && ride.paid && (
                  <span className="text-xs text-green-600 font-medium">
                    Paid
                  </span>
                )}

                {CANCELLABLE.includes(ride.status) && (
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
