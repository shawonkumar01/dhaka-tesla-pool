import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb, createPassenger, createDriver } from "./helpers";
import { tryMatch } from "../src/lib/matching";

describe("concurrent last-seat race", () => {
  beforeEach(resetDb);

  it("only one of two simultaneous requests wins the last seat", async () => {
    const { vehicle } = await createDriver(
      "Jashim",
      "jashim@test.com",
      "Bullet",
      3,
      "Banani",
    );

    // Pre-fill 2 of 3 seats so exactly one seat remains
    const pool = await prisma.pool.create({
      data: { vehicleId: vehicle.id, status: "OPEN", seatsUsed: 2 },
    });
    const filler1 = await createPassenger("Rafiq", "rafiq@test.com");
    const filler2 = await createPassenger("Existing", "existing@test.com");
    for (const p of [filler1, filler2]) {
      await prisma.rideRequest.create({
        data: {
          passengerId: p.id,
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
    }

    const nusrat = await createPassenger("Nusrat", "nusrat@test.com");
    const shirin = await createPassenger("Shirin", "shirin@test.com");

    async function attempt(passengerId: string) {
      return prisma.$transaction(async (tx) => {
        const ride = await tx.rideRequest.create({
          data: {
            passengerId,
            pickupZone: "Banani",
            destinationZone: "Mohakhali",
            seats: 1,
            status: "REQUESTED",
            baseFare: 3000,
            distanceCharge: 3600,
            finalFare: 6600,
          },
        });
        return tryMatch(tx, ride);
      });
    }

    // Fire both at nearly the same instant
    const [nusratMatched, shirinMatched] = await Promise.all([
      attempt(nusrat.id),
      attempt(shirin.id),
    ]);

    // Exactly one should have won the last seat; the other stays REQUESTED
    expect([nusratMatched, shirinMatched].filter(Boolean).length).toBe(1);

    const finalPool = await prisma.pool.findUniqueOrThrow({
      where: { id: pool.id },
    });
    expect(finalPool.seatsUsed).toBeLessThanOrEqual(3); // never overbooked

    const stillWaiting = await prisma.rideRequest.count({
      where: { status: "REQUESTED", poolId: null },
    });
    expect(stillWaiting).toBe(1);
  });
});
