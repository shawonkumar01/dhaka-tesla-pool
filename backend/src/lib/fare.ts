import { ZONE_COORDS } from './zones';

// All money is integer poysha (1 Taka = 100 poysha)
export const BASE_FARE = 3000;          // ৳30 per seat
export const PER_KM = 2000;             // ৳20 per km per seat
export const POOL_DISCOUNT_PERCENT = 20;
const MIN_DISTANCE_HUNDREDTHS = 100;    // minimum 1.00 km

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Distance in hundredths of a km (integer), e.g. 176 = 1.76 km
export function distanceHundredthsKm(pickupZone: string, destinationZone: string): number {
  const km = haversineKm(ZONE_COORDS[pickupZone], ZONE_COORDS[destinationZone]);
  return Math.max(MIN_DISTANCE_HUNDREDTHS, Math.round(km * 100));
}

export function calculateFare(
  pickupZone: string,
  destinationZone: string,
  seats: number,
  isPooled: boolean
) {
  const hundredths = distanceHundredthsKm(pickupZone, destinationZone);
  const baseFare = BASE_FARE * seats;
  const distanceCharge = hundredths * (PER_KM / 100) * seats; // 20 poysha per 0.01 km
  const subtotal = baseFare + distanceCharge;
  const poolDiscount = isPooled ? Math.round((subtotal * POOL_DISCOUNT_PERCENT) / 100) : 0;
  return { baseFare, distanceCharge, poolDiscount, finalFare: subtotal - poolDiscount };
}