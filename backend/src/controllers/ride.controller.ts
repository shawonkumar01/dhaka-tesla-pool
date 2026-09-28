import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { isZoneValid, ZONE_COORDS } from "../lib/zones";
import { calculateFare, distanceHundredthsKm } from "../lib/fare";
import { tryMatch, safeDispatch } from "../lib/matching";

const createRideSchema = z.object({
  pickupZone: z.string(),
  destinationZone: z.string(),
  seats: z.number().int().min(1).max(3).default(1),
});

export async function createRideRequest(req: Request, res: Response) {
  const parsed = createRideSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });

  const { pickupZone, destinationZone, seats } = parsed.data;
  const passengerId = req.user!.userId;

  if (!isZoneValid(pickupZone) || !isZoneValid(destinationZone)) {
    return res.status(400).json({ error: "Invalid zone" });
  }

  const fare = calculateFare(pickupZone, destinationZone, seats, false);
  const p = ZONE_COORDS[pickupZone];
  const d = ZONE_COORDS[destinationZone];

  const ride = await prisma.$transaction(async (tx) => {
    const created = await tx.rideRequest.create({
      data: {
        passengerId,
        pickupZone,
        destinationZone,
        seats,
        pickupLat: p.lat,
        pickupLng: p.lng,
        destLat: d.lat,
        destLng: d.lng,
        status: "REQUESTED",
        ...fare,
        statusHistory: { create: [{ toStatus: "REQUESTED" }] },
      },
    });
    await tryMatch(tx, created);
    return tx.rideRequest.findUniqueOrThrow({ where: { id: created.id } });
  });

  res.status(201).json({ rideRequest: ride });
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
export async function estimateFare(req: Request, res: Response) {
  const parsed = createRideSchema.safeParse({
    pickupZone: req.query.pickupZone,
    destinationZone: req.query.destinationZone,
    seats: Number(req.query.seats ?? 1),
  });
  if (!parsed.success) return res.status(400).json({ error: "Invalid query" });

  const { pickupZone, destinationZone, seats } = parsed.data;
  if (!isZoneValid(pickupZone) || !isZoneValid(destinationZone)) {
    return res.status(400).json({ error: "Invalid zone" });
  }

  res.json({
    distanceKm: distanceHundredthsKm(pickupZone, destinationZone) / 100,
    solo: calculateFare(pickupZone, destinationZone, seats, false),
    pooled: calculateFare(pickupZone, destinationZone, seats, true),
  });
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
      const pool = await tx.pool.update({
        where: { id: ride.poolId },
        data: { seatsUsed: { decrement: ride.seats } },
      });
      await tx.pool.update({
        where: { id: pool.id },
        data: { status: pool.seatsUsed <= 0 ? "CANCELLED" : "OPEN" },
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

  await safeDispatch(); // a freed seat may fit someone who is waiting
  res.json({ ride: updated });
}
