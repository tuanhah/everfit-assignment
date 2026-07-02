/**
 * Epley estimated one-rep max: weight × (1 + reps / 30).
 *
 * The DB stores the same formula as the generated column est_1rm_kg,
 * which is authoritative for querying; this pure function exists for
 * unit tests and any response-side recomputation. Applies to all rep
 * counts (reps = 1 gives weight × 31/30 — standard Epley behavior).
 */
export function epley1Rm(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}
