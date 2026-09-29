import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb, createPassenger, createDriver } from "./helpers";
import { tryMatch } from "../src/lib/matching";

describe("pool capacity", () => {
  beforeEach(resetDb);

  it("never lets seatsUsed exceed the vehicle's capacity", async () => {
    const { vehicle } = await createDriver(
      "Jashim",
      "jashim@test.com",
      "Bullet",
      3,
      "Banani",
    );
    const riders = await Promise.all([
      createPassenger("Nusrat", "nusrat@test.com"),
      createPassenger("Rafiq", "rafiq@test.com"),
      createPassenger("Shirin", "shirin@test.com"),
      createPassenger("Extra", "extra@test.com"),
    ]);

    for (const rider of riders) {
      await prisma.$transaction(async (tx) => {
        const ride = await tx.rideRequest.create({
          data: {
            passengerId: rider.id,
            pickupZone: "Banani",
            destinationZone: "Mohakhali",
            seats: 1,
            status: "REQUESTED",
            baseFare: 3000,
            distanceCharge: 3600,
            finalFare: 6600,
          },
        });
        await tryMatch(tx, ride);
      });
    }

    const pool = await prisma.pool.findFirstOrThrow({
      where: { vehicleId: vehicle.id },
    });
    expect(pool.seatsUsed).toBeLessThanOrEqual(3);

    const matched = await prisma.rideRequest.count({
      where: { poolId: pool.id, status: { not: "CANCELLED" } },
    });
    expect(matched).toBe(3); // exactly 3 got in, the 4th stays REQUESTED

    const waiting = await prisma.rideRequest.count({
      where: { status: "REQUESTED", poolId: null },
    });
    expect(waiting).toBe(1);
  });
});
