export type CapacityBand = "available" | "busy" | "nearly_full" | "full";

export function capacityBand(percent: number, busy = 70, nearlyFull = 90, full = 100): CapacityBand {
  if (percent >= full) return "full";
  if (percent >= nearlyFull) return "nearly_full";
  if (percent >= busy) return "busy";
  return "available";
}

export function capacityLabel(band: CapacityBand) {
  return ({ available: "Available", busy: "Busy", nearly_full: "Nearly Full", full: "Full / Over Capacity" } as const)[band];
}

export function estimateProductionMinutes(quantity: number, unitsPerHour: number, setupMinutes: number, manualMinutes = 0) {
  if (manualMinutes > 0) return Math.ceil(manualMinutes);
  if (unitsPerHour <= 0) return 0;
  return Math.max(1, Math.ceil(setupMinutes + (quantity / unitsPerHour) * 60));
}

