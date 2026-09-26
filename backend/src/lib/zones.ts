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
