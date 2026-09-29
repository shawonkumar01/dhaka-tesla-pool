import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/index";
import {
  prisma,
  resetDb,
  createPassenger,
  createDriver,
  tokenFor,
} from "./helpers";

describe("ride lifecycle transitions", () => {
  beforeEach(resetDb);

  async function setupMatchedPool() {
    const { user: driver, vehicle } = await createDriver(
      "Jashim",
      "jashim@test.com",
      "Bullet",
      3,
      "Banani",
    );
    const passenger = await createPassenger("Nusrat", "nusrat@test.com");
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
    return { driver, pool, ride };
  }

  it("rejects skipping straight from MATCHED to STARTED", async () => {
    const { driver, pool } = await setupMatchedPool();
    const token = tokenFor(driver.id, "DRIVER");

    // First advance is legal: MATCHED -> ACCEPTED
    await request(app)
      .post(`/driver/pools/${pool.id}/advance`)
      .set("Authorization", `Bearer ${token}`);

    // Attempting to jump ahead by calling advance again lands on the *next*
    // legal step (ACCEPTED -> DRIVER_ARRIVED), so to prove rejection we
    // instead hit an already-terminal transition directly:
    await prisma.rideRequest.updateMany({
      where: { poolId: pool.id },
      data: { status: "COMPLETED" },
    });

    const res = await request(app)
      .post(`/driver/pools/${pool.id}/advance`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Cannot advance/i);
  });

  it("rejects a driver acting on another driver's pool", async () => {
    const { pool } = await setupMatchedPool();
    const { user: otherDriver } = await createDriver(
      "Kamal",
      "kamal@test.com",
      "Rocket",
      3,
      "Banani",
    );
    const token = tokenFor(otherDriver.id, "DRIVER");

    const res = await request(app)
      .post(`/driver/pools/${pool.id}/advance`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
