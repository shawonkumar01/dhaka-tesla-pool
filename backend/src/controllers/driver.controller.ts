import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";

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
  MATCHED: "DRIVER_ARRIVED",
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

  // All ride requests in a pool should be at the same status, since they
  // move through the trip together. We use the first ride's status as the
  // pool's effective status for transition purposes.
  const currentRideStatus = pool.rideRequests[0]?.status;
  if (!currentRideStatus) {
    return res.status(400).json({ error: "Pool has no ride requests" });
  }

  const nextStatus = VALID_TRANSITIONS[currentRideStatus];
  if (!nextStatus) {
    return res
      .status(400)
      .json({ error: `Cannot advance from status ${currentRideStatus}` });
  }

  const result = await prisma.$transaction(async (tx) => {
    // Update every ride request in the pool together
    await tx.rideRequest.updateMany({
      where: { poolId: pool.id },
      data: { status: nextStatus as any },
    });

    // Log history per ride request (updateMany can't create relations, so loop)
    for (const ride of pool.rideRequests) {
      await tx.rideStatusHistory.create({
        data: {
          rideRequestId: ride.id,
          fromStatus: currentRideStatus as any,
          toStatus: nextStatus as any,
        },
      });
    }

    // Sync pool status for COMPLETED
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

    return tx.rideRequest.findMany({ where: { poolId: pool.id } });
  });

  res.json({ rides: result });
}
