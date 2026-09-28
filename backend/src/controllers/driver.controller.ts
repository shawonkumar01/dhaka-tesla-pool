import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { safeDispatch } from "../lib/matching";
import { calculateFare } from "../lib/fare";

// --- Go online/offline ---

export async function setOnlineStatus(req: Request, res: Response) {
  const schema = z.object({
    isOnline: z.boolean(),
    currentZone: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });

  const driverId = req.user!.userId;

  const vehicle = await prisma.vehicle.findUnique({ where: { driverId } });
  if (!vehicle)
    return res
      .status(404)
      .json({ error: "No vehicle registered for this driver" });

  if (
    parsed.data.isOnline &&
    !parsed.data.currentZone &&
    !vehicle.currentZone
  ) {
    return res
      .status(400)
      .json({ error: "currentZone is required to go online" });
  }

  const updated = await prisma.vehicle.update({
    where: { driverId },
    data: {
      isOnline: parsed.data.isOnline,
      ...(parsed.data.currentZone
        ? { currentZone: parsed.data.currentZone }
        : {}),
    },
  });

  if (parsed.data.isOnline) await safeDispatch(); // a driver coming online picks up waiting riders

  res.json({ vehicle: updated });
}

// --- View own vehicle + active pool(s) with passengers ---

export async function getMyVehicleStatus(req: Request, res: Response) {
  const driverId = req.user!.userId;

  const vehicle = await prisma.vehicle.findUnique({
    where: { driverId },
    include: {
      pools: {
        where: { status: { in: ["OPEN", "FULL", "IN_PROGRESS"] } },
        include: {
          rideRequests: {
            where: { status: { not: "CANCELLED" } },
            include: {
              passenger: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });

  if (!vehicle)
    return res
      .status(404)
      .json({ error: "No vehicle registered for this driver" });

  res.json({ vehicle });
}

const registerVehicleSchema = z.object({
  name: z.string().min(1),
  capacity: z.number().int().min(1).max(4),
});

export async function registerVehicle(req: Request, res: Response) {
  const parsed = registerVehicleSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.flatten() });

  const driverId = req.user!.userId;

  const existing = await prisma.vehicle.findUnique({ where: { driverId } });
  if (existing) {
    return res
      .status(409)
      .json({ error: "You already have a registered vehicle" });
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      driverId,
      name: parsed.data.name,
      capacity: parsed.data.capacity,
      isOnline: false,
    },
  });

  res.status(201).json({ vehicle });
}

// --- Ride history (all past pools/trips for this driver's vehicle) ---

export async function getRideHistory(req: Request, res: Response) {
  const driverId = req.user!.userId;

  const vehicle = await prisma.vehicle.findUnique({ where: { driverId } });
  if (!vehicle)
    return res
      .status(404)
      .json({ error: "No vehicle registered for this driver" });

  const pools = await prisma.pool.findMany({
    where: { vehicleId: vehicle.id },
    orderBy: { createdAt: "desc" },
    include: {
      rideRequests: {
        include: { passenger: { select: { id: true, name: true } } },
      },
    },
  });

  res.json({ pools });
}

// --- Transition a pool's lifecycle (and all its ride requests together) ---

const VALID_TRANSITIONS: Record<string, string> = {
  MATCHED: "ACCEPTED",
  ACCEPTED: "DRIVER_ARRIVED",
  DRIVER_ARRIVED: "STARTED",
  STARTED: "COMPLETED",
};

export async function advancePoolStatus(req: Request, res: Response) {
  const poolId = req.params.poolId as string;
  const driverId = req.user!.userId;

  const vehicle = await prisma.vehicle.findUnique({ where: { driverId } });
  if (!vehicle)
    return res
      .status(404)
      .json({ error: "No vehicle registered for this driver" });

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { rideRequests: true },
  });

  if (!pool) return res.status(404).json({ error: "Pool not found" });
  if (pool.vehicleId !== vehicle.id) {
    return res.status(403).json({ error: "Not your vehicle's pool" });
  }

  // Cancelled riders keep their poolId, so they must be ignored here
  const activeRides = pool.rideRequests.filter((r) => r.status !== "CANCELLED");
  const currentRideStatus = activeRides[0]?.status;
  if (!currentRideStatus) {
    return res.status(400).json({ error: "Pool has no active ride requests" });
  }

  const nextStatus = VALID_TRANSITIONS[currentRideStatus];
  if (!nextStatus) {
    return res
      .status(400)
      .json({ error: `Cannot advance from status ${currentRideStatus}` });
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.rideRequest.updateMany({
      where: { poolId: pool.id, status: { not: "CANCELLED" } },
      data: { status: nextStatus as any },
    });

    for (const ride of activeRides) {
      await tx.rideStatusHistory.create({
        data: {
          rideRequestId: ride.id,
          fromStatus: currentRideStatus as any,
          toStatus: nextStatus as any,
        },
      });
    }

    if (nextStatus === "COMPLETED") {
      await tx.pool.update({
        where: { id: pool.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    } else if (nextStatus === "STARTED") {
      await tx.pool.update({
        where: { id: pool.id },
        data: { status: "IN_PROGRESS", startedAt: new Date() },
      });
    }

    return tx.rideRequest.findMany({
      where: { poolId: pool.id, status: { not: "CANCELLED" } },
    });
  });

  if (nextStatus === "COMPLETED") await safeDispatch(); // vehicle is free again

  res.json({ rides: result });
}

// --- Decline a pool that is still awaiting acceptance ---

export async function declinePool(req: Request, res: Response) {
  const poolId = req.params.poolId as string;
  const driverId = req.user!.userId;

  const vehicle = await prisma.vehicle.findUnique({ where: { driverId } });
  if (!vehicle)
    return res
      .status(404)
      .json({ error: "No vehicle registered for this driver" });

  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { rideRequests: true },
  });
  if (!pool) return res.status(404).json({ error: "Pool not found" });
  if (pool.vehicleId !== vehicle.id)
    return res.status(403).json({ error: "Not your vehicle's pool" });

  // Only a pool where every live rider is still MATCHED can be declined
  const activeRides = pool.rideRequests.filter((r) => r.status !== "CANCELLED");
  if (
    activeRides.length === 0 ||
    activeRides.some((r) => r.status !== "MATCHED")
  ) {
    return res
      .status(400)
      .json({ error: "Only a pool awaiting acceptance can be declined" });
  }

  await prisma.$transaction(async (tx) => {
    const soloFare = calculateFare(false);

    for (const ride of activeRides) {
      // Remember the decline so this ride is never offered to this vehicle again
      await tx.poolDecline.create({
        data: { rideRequestId: ride.id, vehicleId: vehicle.id },
      });

      // Riders go back to waiting and lose the pool discount
      await tx.rideRequest.update({
        where: { id: ride.id },
        data: {
          status: "REQUESTED",
          poolId: null,
          poolDiscount: soloFare.poolDiscount,
          finalFare: soloFare.finalFare,
        },
      });

      await tx.rideStatusHistory.create({
        data: {
          rideRequestId: ride.id,
          fromStatus: "MATCHED",
          toStatus: "REQUESTED",
          note: "Driver declined pool",
        },
      });
    }

    await tx.pool.update({
      where: { id: pool.id },
      data: { status: "CANCELLED", seatsUsed: 0 },
    });
  });

  await safeDispatch(); // offer these riders to the next eligible driver

  res.json({ message: "Pool declined; riders returned to the waiting queue" });
}
