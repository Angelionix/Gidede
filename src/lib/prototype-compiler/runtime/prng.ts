/**
 * mulberry32 — deterministic PRNG.
 *
 * Returns a function that produces pseudo-random floats in [0, 1).
 * Same seed → same sequence, across process restarts and Node versions.
 *
 * Design spec: docs/PLAYABLE_PROTOTYPE_COMPILER_DESIGN.md (section 9)
 */

export function createMulberry32(seed: string): () => number {
  // Hash the string seed to a 32-bit integer.
  let a = hashStringToUint32(seed);

  return function next(): number {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToUint32(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/**
 * Generate a deterministic integer in [min, max] (inclusive).
 */
export function randInt(prng: () => number, min: number, max: number): number {
  return Math.floor(prng() * (max - min + 1)) + min;
}

/**
 * Generate a deterministic float in [min, max).
 */
export function randFloat(prng: () => number, min: number, max: number): number {
  return prng() * (max - min) + min;
}

/**
 * Pick a deterministic element from an array.
 */
export function randPick<T>(prng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(prng() * arr.length)];
}
