// All amounts in poysha (1 Taka = 100 poysha) — integers only, avoids float rounding errors.
const BASE_FARE = 5000;       // 50.00 Taka flat base
const PER_ZONE_HOP_CHARGE = 3000; // 30.00 Taka — flat distance charge per request (simplified, no real routing)
const POOL_DISCOUNT = 1500;   // 15.00 Taka discount when sharing a pool with >=1 other passenger

export function calculateFare(isPooled: boolean) {
  const baseFare = BASE_FARE;
  const distanceCharge = PER_ZONE_HOP_CHARGE;
  const poolDiscount = isPooled ? POOL_DISCOUNT : 0;
  const finalFare = baseFare + distanceCharge - poolDiscount;

  return { baseFare, distanceCharge, poolDiscount, finalFare };
}