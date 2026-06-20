// Small numeric helpers shared across the app (render, presets, face detection,
// API query parsing) so the same clamp logic isn't reimplemented per module.

// Clamp a number into the inclusive [lo, hi] range.
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Clamp into the normalized [0, 1] range (focal points, ratios).
export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

// Parse a possibly-missing string into an integer clamped to [min, max],
// falling back to `fallback` when absent or unparseable.
export function clampInt(
  raw: string | null | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = raw == null ? fallback : Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return clamp(n, min, max);
}
