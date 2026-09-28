import { Prisma, PoolStatus, RideStatus } from "@prisma/client";
import prisma from "./prisma";
import { areDestinationsCompatible } from "./zones";
import { calculateFare } from "./fare";

type Tx = Prisma.TransactionClient;
type WaitingRide = {
  id: string;
  pickupZone: string;
  destinationZone: string;
  seats: number;
};

const ACTIVE_POOL: PoolStatus[] = ["OPEN", "FULL", "IN_PROGRESS"];

// Try to place one REQUESTED ride: first join a compatible open pool,
// otherwise open a new pool on a free vehicle in the pickup zone.
// Vehicles that previously declined this ride are never offered it again.
// Returns true if the ride was matched.
export async function tryMatch(tx: Tx, ride: WaitingRide): Promise<boolean> {
  const declined = await tx.poolDecline.findMany({
    where: { rideRequestId: ride.id },
    select: { vehicleId: true },
  });
  const excluded = declined.map((d) => d.vehicleId);

  // --- 1. Join an existing pool ---
  const candidatePools = await tx.pool.findMany({
    where: {
      status: "OPEN",
      vehicleId: { notIn: excluded },
      vehicle: { isOnline: true },
    },
    include: {
      vehicle: true,
      rideRequests: { where: { status: { not: "CANCELLED" } } },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const pool of candidatePools) {
    const riders = pool.rideRequests;
    if (riders.length === 0) continue;
    if (pool.seatsUsed + ride.seats > pool.vehicle.capacity) continue;

    const compatible = riders.every(
      (r) =>
        ["MATCHED", "ACCEPTED"].includes(r.status) &&
        r.pickupZone === ride.pickupZone &&
        areDestinationsCompatible(r.destinationZone, ride.destinationZone),
    );
    if (!compatible) continue;

    // Row lock: two concurrent requests can't both claim the last seat.
    // Capacity is re-checked AFTER the lock, which is the authoritative check.
    const [row] = await tx.$queryRaw<
      { seatsUsed: number; capacity: number; status: string }[]
    >`
      SELECT p."seatsUsed", v.capacity, p.status::text AS status
      FROM "Pool" p JOIN "Vehicle" v ON v.id = p."vehicleId"
      WHERE p.id = ${pool.id}
      FOR UPDATE OF p`;

    if (
      !row ||
      row.status !== "OPEN" ||
      row.seatsUsed + ride.seats > row.capacity
    )
      continue;

    const newSeats = row.seatsUsed + ride.seats;
    const fare = calculateFare(
      ride.pickupZone,
      ride.destinationZone,
      ride.seats,
      true,
    );
    // A joiner inherits ACCEPTED if the driver already accepted this pool
    const joinStatus: RideStatus =
      riders[0].status === "ACCEPTED" ? "ACCEPTED" : "MATCHED";

    await tx.pool.update({
      where: { id: pool.id },
      data: {
        seatsUsed: newSeats,
        status: newSeats >= row.capacity ? "FULL" : "OPEN",
      },
    });

    // Riders already in the pool now also share, so they get the discount too
    for (const r of riders) {
      if (r.poolDiscount > 0) continue; // already discounted
      const f = calculateFare(r.pickupZone, r.destinationZone, r.seats, true);
      await tx.rideRequest.update({
        where: { id: r.id },
        data: { poolDiscount: f.poolDiscount, finalFare: f.finalFare },
      });
    }

    await tx.rideRequest.update({
      where: { id: ride.id },
      data: {
        status: joinStatus,
        poolId: pool.id,
        poolDiscount: fare.poolDiscount,
        finalFare: fare.finalFare,
      },
    });

    const history: Prisma.RideStatusHistoryCreateManyInput[] = [
      { rideRequestId: ride.id, fromStatus: "REQUESTED", toStatus: "MATCHED" },
    ];
    if (joinStatus === "ACCEPTED") {
      history.push({
        rideRequestId: ride.id,
        fromStatus: "MATCHED",
        toStatus: "ACCEPTED",
      });
    }
    await tx.rideStatusHistory.createMany({ data: history });
    return true;
  }

  // --- 2. Open a new pool on a free vehicle in the pickup zone ---
  const vehicles = await tx.vehicle.findMany({
    where: {
      isOnline: true,
      currentZone: ride.pickupZone,
      capacity: { gte: ride.seats },
      id: { notIn: excluded },
    },
  });

  for (const v of vehicles) {
    // Lock the vehicle row so two requests can't both open a pool on it
    await tx.$queryRaw`SELECT id FROM "Vehicle" WHERE id = ${v.id} FOR UPDATE`;
    const busy = await tx.pool.count({
      where: { vehicleId: v.id, status: { in: ACTIVE_POOL } },
    });
    if (busy > 0) continue;

    const pool = await tx.pool.create({
      data: {
        vehicleId: v.id,
        seatsUsed: ride.seats,
        status: ride.seats >= v.capacity ? "FULL" : "OPEN",
      },
    });
    await tx.rideRequest.update({
      where: { id: ride.id },
      data: { status: "MATCHED", poolId: pool.id },
    });
    await tx.rideStatusHistory.create({
      data: {
        rideRequestId: ride.id,
        fromStatus: "REQUESTED",
        toStatus: "MATCHED",
      },
    });
    return true;
  }

  return false; // stays REQUESTED, waiting for a driver
}

// Re-run matching for every waiting ride, oldest first (fair queue).
export async function dispatchWaitingRequests() {
  const waiting = await prisma.rideRequest.findMany({
    where: { status: "REQUESTED", poolId: null },
    orderBy: { createdAt: "asc" },
  });

  for (const w of waiting) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.rideRequest.findUnique({ where: { id: w.id } });
      if (!fresh || fresh.status !== "REQUESTED" || fresh.poolId) return; // changed meanwhile
      await tryMatch(tx, fresh);
    });
  }
}

// Dispatch must never break the action that triggered it
export async function safeDispatch() {
  try {
    await dispatchWaitingRequests();
  } catch (err) {
    console.error("dispatchWaitingRequests failed", err);
  }
}
