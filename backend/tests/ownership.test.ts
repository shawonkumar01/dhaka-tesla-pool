import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../src/index";
import { prisma, resetDb, createPassenger, tokenFor } from "./helpers";

describe("ride ownership", () => {
  beforeEach(resetDb);

  it("blocks cancelling someone else's ride", async () => {
    const owner = await createPassenger("Nusrat", "nusrat@test.com");
    const intruder = await createPassenger("Rafiq", "rafiq@test.com");

    const ride = await prisma.rideRequest.create({
      data: {
        passengerId: owner.id,
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
      .set("Authorization", `Bearer ${tokenFor(intruder.id, "PASSENGER")}`);

    expect(res.status).toBe(403);

    const unchanged = await prisma.rideRequest.findUniqueOrThrow({
      where: { id: ride.id },
    });
    expect(unchanged.status).toBe("REQUESTED");
  });

  it("blocks viewing someone else's ride by id", async () => {
    const owner = await createPassenger("Nusrat", "nusrat@test.com");
    const intruder = await createPassenger("Rafiq", "rafiq@test.com");

    const ride = await prisma.rideRequest.create({
      data: {
        passengerId: owner.id,
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
      .get(`/rides/${ride.id}`)
      .set("Authorization", `Bearer ${tokenFor(intruder.id, "PASSENGER")}`);

    expect(res.status).toBe(403);
  });
});
