/**
 * Small deterministic PRNG (mulberry32). Used for the skyline's window pattern
 * and for the scorer's jitter, so a given "roll" always produces the same
 * result while a new roll produces a different one.
 */
export function mulberry32(seed: number): () => number {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
