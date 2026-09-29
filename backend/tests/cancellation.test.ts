import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/index";
import { prisma, resetDb, createPassenger, tokenFor } from "./helpers";

describe("cancellation rules", () => {
  beforeEach(resetDb);

  it("allows cancelling a REQUESTED ride", async () => {
    const passenger = await createPassenger("Nusrat", "nusrat@test.com");
    const ride = await prisma.rideRequest.create({
      data: {
        passengerId: passenger.id,
        pickupZone: "Banani",
        destinationZone: "Mohakhali",
        seats: 1,
        status: "REQUESTED",
        baseFare: 3000,
        distanceCharge: 3600,
        finalFare: 6600,
      },
    });

    const res = await request(app)
      .post(`/rides/${ride.id}/cancel`)
      .set("Authorization", `Bearer ${tokenFor(passenger.id, "PASSENGER")}`);

    expect(res.status).toBe(200);
    expect(res.body.ride.status).toBe("CANCELLED");
  });

  it("blocks cancelling a STARTED ride", async () => {
    const passenger = await createPassenger("Nusrat", "nusrat@test.com");
    const ride = await prisma.rideRequest.create({
      data: {
        passengerId: passenger.id,
        pickupZone: "Banani",
        destinationZone: "Mohakhali",
        seats: 1,
        status: "STARTED",
        baseFare: 3000,
        distanceCharge: 3600,
        finalFare: 6600,
      },
    });

    const res = await request(app)
      .post(`/rides/${ride.id}/cancel`)
      .set("Authorization", `Bearer ${tokenFor(passenger.id, "PASSENGER")}`);

    expect(res.status).toBe(400);
  });

  it("frees the seat in the pool when a pooled ride is cancelled", async () => {
    const { prisma: _ } = { prisma }; // no-op, keeps import used
    const passenger = await createPassenger("Nusrat", "nusrat@test.com");
    const vehicle = await prisma.vehicle.create({
      data: {
        driverId: (
          await prisma.user.create({
            data: {
              name: "Jashim",
              email: "jashim2@test.com",
              passwordHash: "x",
              role: "DRIVER",
            },
          })
        ).id,
        name: "Bullet",
        capacity: 3,
        isOnline: true,
        currentZone: "Banani",
      },
    });
    const pool = await prisma.pool.create({
      data: { vehicleId: vehicle.id, status: "OPEN", seatsUsed: 1 },
    });
    const ride = await prisma.rideRequest.create({
      data: {
        passengerId: passenger.id,
        pickupZone: "Banani",
        destinationZone: "Mohakhali",
        seats: 1,
        poolId: pool.id,
        status: "MATCHED",
        baseFare: 3000,
        distanceCharge: 3600,
        finalFare: 6600,
      },
    });

    await request(app)
      .post(`/rides/${ride.id}/cancel`)
      .set("Authorization", `Bearer ${tokenFor(passenger.id, "PASSENGER")}`);

    const updatedPool = await prisma.pool.findUniqueOrThrow({
      where: { id: pool.id },
    });
    expect(updatedPool.seatsUsed).toBe(0);
  });
});
