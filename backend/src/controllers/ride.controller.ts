import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { isZoneValid, areDestinationsCompatible } from "../lib/zones";
import { calculateFare } from "../lib/fare";

const createRideSchema = z.object({
  pickupZone: z.string(),
  destinationZone: z.string(),
  seats: z.number().int().min(1).max(3).default(1),
});

export async function createRideRequest(req: Request, res: Response) {
  const parsed = createRideSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { pickupZone, destinationZone, seats } = parsed.data;
  const passengerId = req.user!.userId;

  if (!isZoneValid(pickupZone) || !isZoneValid(destinationZone)) {
    return res.status(400).json({ error: "Invalid zone" });
  }

  const result = await prisma.$transaction(async (tx) => {
    const candidatePools = await tx.pool.findMany({
      where: { status: "OPEN" },
      include: { vehicle: true, rideRequests: true },
    });

    let matchedPool = null;

    for (const pool of candidatePools) {
      const hasRoom = pool.seatsUsed + seats <= pool.vehicle.capacity;
      if (!hasRoom) continue;

      const compatible = pool.rideRequests.every(
        (r) =>
          r.pickupZone === pickupZone &&
          areDestinationsCompatible(r.destinationZone, destinationZone),
      );

      if (compatible) {
        matchedPool = pool;
        break;
      }
    }

    if (matchedPool) {
      const locked: { id: string; seatsUsed: number; capacity: number }[] =
        await tx.$queryRaw`
          SELECT p.id, p."seatsUsed", v.capacity
          FROM "Pool" p
          JOIN "Vehicle" v ON v.id = p."vehicleId"
          WHERE p.id = ${matchedPool.id}
          FOR UPDATE
        `;

      const lockedPool = locked[0];
      if (!lockedPool || lockedPool.seatsUsed + seats > lockedPool.capacity) {
        // Someone else took the seat between our check and the lock — fall through to new pool
        matchedPool = null;
      } else {
        await tx.pool.update({
          where: { id: matchedPool.id },
          data: { seatsUsed: { increment: seats } },
        });

        const isNowFull = lockedPool.seatsUsed + seats >= lockedPool.capacity;
        if (isNowFull) {
          await tx.pool.update({
            where: { id: matchedPool.id },
            data: { status: "FULL" },
          });
        }

        const fare = calculateFare(true);

        const rideRequest = await tx.rideRequest.create({
          data: {
            passengerId,
            pickupZone,
            destinationZone,
            seats,
            poolId: matchedPool.id,
            status: "MATCHED",
            ...fare,
            statusHistory: {
              create: [
                { toStatus: "REQUESTED" },
                { fromStatus: "REQUESTED", toStatus: "MATCHED" },
              ],
            },
          },
        });

        return rideRequest;
      }
    }

    // No compatible pool with room — find any online vehicle with enough
    // total capacity and open a new pool on it.
    const availableVehicle = await tx.vehicle.findFirst({
      where: {
        isOnline: true,
        capacity: { gte: seats },
        pools: {
          none: { status: { in: ["OPEN", "FULL", "IN_PROGRESS"] } },
        },
      },
    });
    const fare = calculateFare(false);

    if (!availableVehicle) {
      // No driver online — request sits unmatched, to be picked up later.
      return tx.rideRequest.create({
        data: {
          passengerId,
          pickupZone,
          destinationZone,
          seats,
          status: "REQUESTED",
          ...fare,
          statusHistory: { create: [{ toStatus: "REQUESTED" }] },
        },
      });
    }

    const newPool = await tx.pool.create({
      data: {
        vehicleId: availableVehicle.id,
        status: "OPEN",
        seatsUsed: seats,
      },
    });

    return tx.rideRequest.create({
      data: {
        passengerId,
        pickupZone,
        destinationZone,
        seats,
        poolId: newPool.id,
        status: "MATCHED",
        ...fare,
        statusHistory: {
          create: [
            { toStatus: "REQUESTED" },
            { fromStatus: "REQUESTED", toStatus: "MATCHED" },
          ],
        },
      },
    });
  });

  res.status(201).json({ rideRequest: result });
}

export async function getMyRides(req: Request, res: Response) {
  const passengerId = req.user!.userId;

  const rides = await prisma.rideRequest.findMany({
    where: { passengerId },
    orderBy: { createdAt: "desc" },
    include: { statusHistory: true },
  });

  res.json({ rides });
}

export async function getRideById(req: Request, res: Response) {
  const id = req.params.id as string;
  const passengerId = req.user!.userId;

  const ride = await prisma.rideRequest.findUnique({
    where: { id },
    include: { statusHistory: true },
  });

  if (!ride) return res.status(404).json({ error: "Ride not found" });
  if (ride.passengerId !== passengerId) {
    return res.status(403).json({ error: "Not your ride" });
  }

  res.json({ ride });
}

export async function cancelRide(req: Request, res: Response) {
  const id = req.params.id as string;
  const passengerId = req.user!.userId;

  const ride = await prisma.rideRequest.findUnique({ where: { id } });

  if (!ride) return res.status(404).json({ error: "Ride not found" });
  if (ride.passengerId !== passengerId) {
    return res.status(403).json({ error: "Not your ride" });
  }
  if (["STARTED", "COMPLETED", "CANCELLED"].includes(ride.status)) {
    return res
      .status(400)
      .json({ error: `Cannot cancel a ride in ${ride.status} status` });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (ride.poolId) {
      await tx.pool.update({
        where: { id: ride.poolId },
        data: { seatsUsed: { decrement: ride.seats }, status: "OPEN" },
      });
    }

    return tx.rideRequest.update({
      where: { id },
      data: {
        status: "CANCELLED",
        statusHistory: {
          create: [{ fromStatus: ride.status, toStatus: "CANCELLED" }],
        },
      },
    });
  });

  res.json({ ride: updated });
}
