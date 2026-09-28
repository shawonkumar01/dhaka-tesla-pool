// Predefined Dhaka zones (Section 4 — no real map API)
export const DHAKA_ZONES = [
  "Banani",
  "Gulshan 1",
  "Gulshan 2",
  "Mohakhali",
  "Dhanmondi",
  "Mirpur",
  "Uttara",
  "Farmgate",
  "Bashundhara",
] as const;

export type Zone = (typeof DHAKA_ZONES)[number];

const COMPATIBLE_DESTINATIONS: Record<string, string[]> = {
  Mohakhali: ["Gulshan 1", "Gulshan 2"],
  "Gulshan 1": ["Mohakhali", "Gulshan 2"],
  "Gulshan 2": ["Mohakhali", "Gulshan 1"],
  Dhanmondi: ["Farmgate"],
  Farmgate: ["Dhanmondi"],
};
export const ZONE_COORDS: Record<string, { lat: number; lng: number }> = {
  'Banani':      { lat: 23.7937, lng: 90.4066 },
  'Gulshan 1':   { lat: 23.7806, lng: 90.4163 },
  'Gulshan 2':   { lat: 23.7925, lng: 90.4148 },
  'Mohakhali':   { lat: 23.7775, lng: 90.4055 },
  'Dhanmondi':   { lat: 23.7461, lng: 90.3742 },
  'Mirpur':      { lat: 23.8069, lng: 90.3687 },
  'Uttara':      { lat: 23.8759, lng: 90.3795 },
  'Farmgate':    { lat: 23.7561, lng: 90.3872 },
  'Bashundhara': { lat: 23.8193, lng: 90.4526 },
};

export function isZoneValid(zone: string): boolean {
  return (DHAKA_ZONES as readonly string[]).includes(zone);
}

export function areDestinationsCompatible(
  destA: string,
  destB: string,
): boolean {
  if (destA === destB) return true;
  return COMPATIBLE_DESTINATIONS[destA]?.includes(destB) ?? false;
}
