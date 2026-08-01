/**
 * Gidede — RPS cycle detector (Block 4, roadmap R5-05).
 *
 * Before R5-05, the intransitive analysis only checked CONSECUTIVE triples
 * (i, (i+1)%n, (i+2)%n) and `break`-ed after the first match. This missed
 * non-consecutive cycles like 0→2→4→0 and severely undercounted RPS structure.
 *
 * R5-05 introduces `findAllRpsCycles(payoffMatrix, names, options)` which:
 *   - Enumerates ALL ordered triples (i, j, k) with i≠j≠k (not just consecutive).
 *   - Does NOT break after the first match — returns all cycles found.
 *   - Optionally extends to 4-cycles and 5-cycles via `maxLength`.
 *   - Returns each cycle with its strength (average payoff along the cycle).
 */

export interface RpsCycle {
  /** Ordered strategy names forming the cycle. */
  cycle: string[];
  /** Strategy indices (for programmatic use). */
  indices: number[];
  /** Average payoff along the cycle (higher = stronger RPS structure). */
  strength: number;
  /** Cycle length (3 = rock-paper-scissors, 4 = extended, etc.). */
  length: number;
}

export interface FindCyclesOptions {
  /** Maximum cycle length to search (default 3). 4 and 5 are expensive for large n. */
  maxLength?: number;
  /** Minimum payoff threshold for an edge to count as "beats" (default 0.1). */
  threshold?: number;
  /** Maximum number of cycles to return (default 20, to avoid explosion). */
  maxResults?: number;
}

/**
 * Find all RPS cycles in a payoff matrix.
 *
 * A cycle is a sequence of distinct strategy indices (i₁ → i₂ → ... → iₖ → i₁)
 * where each step has payoffMatrix[iₘ][iₘ₊₁] > threshold. The classic
 * rock-paper-scissors is a 3-cycle.
 *
 * @param payoffMatrix  Square row-player payoff matrix (positive = row beats column).
 * @param names         Strategy names (for the cycle output).
 * @param options       maxLength (default 3), threshold (default 0.1), maxResults (default 20).
 * @returns Array of RpsCycle, sorted by strength descending.
 */
export function findAllRpsCycles(
  payoffMatrix: number[][],
  names: string[],
  options: FindCyclesOptions = {},
): RpsCycle[] {
  const n = payoffMatrix.length;
  if (n < 3) return [];

  const maxLength = Math.min(options.maxLength ?? 3, n);
  const threshold = options.threshold ?? 0.1;
  const maxResults = options.maxResults ?? 20;

  const cycles: RpsCycle[] = [];

  // Helper: check if payoffMatrix[i][j] > threshold (i beats j).
  const beats = (i: number, j: number): boolean => {
    const row = payoffMatrix[i];
    if (!row || typeof row[j] !== "number") return false;
    return row[j] > threshold;
  };

  // Helper: compute cycle strength (average payoff along the cycle).
  const cycleStrength = (indices: number[]): number => {
    let sum = 0;
    const len = indices.length;
    for (let m = 0; m < len; m++) {
      const next = (m + 1) % len;
      sum += payoffMatrix[indices[m]][indices[next]];
    }
    return Number((sum / len).toFixed(2));
  };

  // Generate all ordered permutations of distinct indices of the given length.
  // For length 3 with n strategies, this is n*(n-1)*(n-2) permutations —
  // manageable for n ≤ ~10 (Balance contract max is 100, but maxLength=3
  // keeps it bounded; we cap results at maxResults).
  const generatePermutations = (length: number): number[][] => {
    const results: number[][] = [];
    const current: number[] = [];

    const backtrack = (start: number) => {
      if (current.length === length) {
        // Check if the cycle closes: last → first must also beat.
        if (beats(current[length - 1], current[0])) {
          results.push([...current]);
        }
        return;
      }
      for (let i = 0; i < n; i++) {
        if (current.includes(i)) continue;
        // For the first element, any i works.
        // For subsequent elements, the previous must beat this one.
        if (current.length > 0 && !beats(current[current.length - 1], i)) continue;
        current.push(i);
        backtrack(start);
        current.pop();
      }
    };

    backtrack(0);
    return results;
  };

  // Search cycles of length 3..maxLength.
  for (let len = 3; len <= maxLength; len++) {
    const perms = generatePermutations(len);
    for (const perm of perms) {
      // Deduplicate: a cycle [0,1,2] is the same as [1,2,0] and [2,0,1].
      // Keep only the lexicographically smallest rotation.
      const minRotation = findMinRotation(perm);
      if (!arrayEquals(perm, minRotation)) continue;

      cycles.push({
        cycle: perm.map((i) => names[i]),
        indices: perm,
        strength: cycleStrength(perm),
        length: len,
      });
      if (cycles.length >= maxResults) break;
    }
    if (cycles.length >= maxResults) break;
  }

  // Sort by strength descending.
  cycles.sort((a, b) => b.strength - a.strength);
  return cycles;
}

/** Find the lexicographically smallest rotation of an array. */
function findMinRotation(arr: number[]): number[] {
  let min = [...arr];
  const current = [...arr];
  for (let i = 1; i < arr.length; i++) {
    current.push(current.shift()!);
    if (compareArrays(current, min) < 0) {
      min = [...current];
    }
  }
  return min;
}

function compareArrays(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return a.length - b.length;
}

function arrayEquals(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
