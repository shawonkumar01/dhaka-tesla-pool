import { describe, it, expect } from "vitest";
import {
  calculateFare,
  distanceHundredthsKm,
  BASE_FARE,
  PER_KM,
  POOL_DISCOUNT_PERCENT,
} from "../src/lib/fare";

describe("fare model: finalFare = baseFare + distanceCharge - poolDiscount", () => {
  it("Nusrat's solo fare (Banani -> Mohakhali) follows the labeled formula", () => {
    const km100 = distanceHundredthsKm("Banani", "Mohakhali");
    const fare = calculateFare("Banani", "Mohakhali", 1, false);

    expect(fare.baseFare).toBe(BASE_FARE);
    expect(fare.distanceCharge).toBe(km100 * (PER_KM / 100));
    expect(fare.poolDiscount).toBe(0);
    expect(fare.finalFare).toBe(fare.baseFare + fare.distanceCharge);
  });

  it("pooling gives exactly 20% off the subtotal", () => {
    const solo = calculateFare("Banani", "Mohakhali", 1, false);
    const pooled = calculateFare("Banani", "Mohakhali", 1, true);

    expect(pooled.poolDiscount).toBe(
      Math.round((solo.finalFare * POOL_DISCOUNT_PERCENT) / 100),
    );
    expect(pooled.finalFare).toBe(solo.finalFare - pooled.poolDiscount);
  });

  it("Rafiq's pooled fare (Banani -> Gulshan 1) is calculated from his own trip", () => {
    const rafiq = calculateFare("Banani", "Gulshan 1", 1, true);
    const km100 = distanceHundredthsKm("Banani", "Gulshan 1");
    const subtotal = BASE_FARE + km100 * (PER_KM / 100);

    expect(rafiq.finalFare).toBe(subtotal - rafiq.poolDiscount);
  });

  it("scales base and distance charge per seat", () => {
    const one = calculateFare("Banani", "Mohakhali", 1, false);
    const two = calculateFare("Banani", "Mohakhali", 2, false);

    expect(two.baseFare).toBe(one.baseFare * 2);
    expect(two.distanceCharge).toBe(one.distanceCharge * 2);
  });

  it("applies a 1.00 km minimum distance for same-zone trips", () => {
    expect(distanceHundredthsKm("Banani", "Banani")).toBe(100);
  });

  it("keeps every amount an integer (no float money)", () => {
    for (const pooled of [true, false]) {
      const fare = calculateFare("Uttara", "Dhanmondi", 3, pooled);
      for (const v of Object.values(fare))
        expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("hand-check: Nusrat and Rafiq pooled fares match the documented values", () => {
    const nusrat = calculateFare("Banani", "Mohakhali", 1, true);
    expect(nusrat).toEqual({
      baseFare: 3000,
      distanceCharge: 3600,
      poolDiscount: 1320,
      finalFare: 5280,
    });

    const rafiq = calculateFare("Banani", "Gulshan 1", 1, true);
    expect(rafiq).toEqual({
      baseFare: 3000,
      distanceCharge: 3520,
      poolDiscount: 1304,
      finalFare: 5216,
    });
  });
});
