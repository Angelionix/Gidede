/**
 * Gidede — MDA iteration loop (Block 3, roadmap R4-08).
 *
 * Replaces the fake `iterations = converged ? 1 : 3` in buildClassicMDA with a
 * real iteration loop that:
 *   1. Evaluates the current mechanic set (forward MDA pass).
 *   2. If overall_match < convergence_threshold, identifies the weakest target
 *      aesthetic and adds a mechanic that would improve its coverage.
 *   3. Re-evaluates and records a diff (what was added, how the score changed).
 *   4. Repeats until converged or max_iterations reached or no more candidate
 *      mechanics can be added.
 *
 * Each iteration CHANGES the candidate set and SAVES a diff, so
 * `iterations_done` reflects the real number of passes performed.
 */

import {
  AESTHETIC_TO_DYNAMICS,
  DYNAMICS_TO_MECHANICS,
  categorizeMechanic,
} from "@/lib/mda/constants";

export interface MechanicSetForMda {
  base: Array<{ mechanic_name: string }>;
  combat: Array<{ mechanic_name: string }>;
  progression: Array<{ mechanic_name: string }>;
  spatial: Array<{ mechanic_name: string }>;
  social: Array<{ mechanic_name: string }>;
}

export interface AestheticsTarget {
  primary: string;
  secondary: string;
  tertiary: string;
}

export interface DynamicsTarget {
  core_dynamics: string[];
  supporting_dynamics: string[];
}

export interface MdaEvaluationResult {
  predicted_aesthetics: Record<string, number>;
  match_scores: Record<string, number>;
  overall_match: number;
  converged: boolean;
  observed_dynamics: string[];
}

export interface IterationDiff {
  iteration: number;
  added_mechanic: string | null;
  added_to_category: string | null;
  target_aesthetic: string | null;
  overall_match_before: number;
  overall_match_after: number;
  converged: boolean;
}

export interface IterationLoopResult extends MdaEvaluationResult {
  /** Real number of iterations performed (>= 1). */
  iterations: number;
  /** Per-iteration diff log. */
  iteration_diffs: IterationDiff[];
  /** Final mechanic set after all iterations. */
  final_mechanic_set: MechanicSetForMda;
  /** Whether the loop converged (overall_match >= threshold at any iteration). */
  converged: boolean;
  /** Why the loop terminated. */
  termination_reason: "converged" | "max_iterations" | "no_candidates" | "already_converged";
}

const ALL_AESTHETICS = [
  "sensation", "fantasy", "narrative", "challenge",
  "fellowship", "discovery", "expression", "submission",
];

/** All mechanic names currently in the set. */
function mechanicNames(set: MechanicSetForMda): string[] {
  return [
    ...set.base, ...set.combat, ...set.progression,
    ...set.spatial, ...set.social,
  ].map((m) => m.mechanic_name);
}

/** Deep-clone a mechanic set (so iterations don't mutate the original). */
function cloneMechanicSet(set: MechanicSetForMda): MechanicSetForMda {
  return {
    base: set.base.map((m) => ({ ...m })),
    combat: set.combat.map((m) => ({ ...m })),
    progression: set.progression.map((m) => ({ ...m })),
    spatial: set.spatial.map((m) => ({ ...m })),
    social: set.social.map((m) => ({ ...m })),
  };
}

/** Add a mechanic to the appropriate category set (no-op if already present). */
function addMechanicToSet(set: MechanicSetForMda, mechanicName: string): string | null {
  const category = categorizeMechanic(mechanicName);
  const bucket = set[category];
  if (bucket.some((m) => m.mechanic_name === mechanicName)) {
    return null; // already present
  }
  bucket.push({ mechanic_name: mechanicName });
  return category;
}

/**
 * Evaluate the current mechanic set: predicted aesthetics, match scores,
 * overall match. Pure function — no side effects.
 */
export function evaluateMdaPass(
  mechanicSet: MechanicSetForMda,
  aesthetics: AestheticsTarget,
): MdaEvaluationResult {
  const allMechs = mechanicNames(mechanicSet);

  // Predicted aesthetics: overlap between the aesthetic's mechanic pool and
  // the current set.
  const predictedAesthetics: Record<string, number> = {};
  for (const a of ALL_AESTHETICS) {
    const dynamics = AESTHETIC_TO_DYNAMICS[a] || [];
    const mechsSet = new Set<string>();
    for (const dyn of dynamics) {
      for (const m of DYNAMICS_TO_MECHANICS[dyn] || []) {
        mechsSet.add(m);
      }
    }
    const mechs = Array.from(mechsSet);
    const overlap = mechs.filter((m) => allMechs.includes(m)).length;
    predictedAesthetics[a] = Number(
      Math.min(1, overlap / Math.max(1, mechs.length)).toFixed(2),
    );
  }

  // Match scores: target aesthetics get a weight boost.
  const matchScores: Record<string, number> = {};
  for (const a of ALL_AESTHETICS) {
    const target =
      a === aesthetics.primary ? 1 :
      a === aesthetics.secondary ? 0.7 :
      a === aesthetics.tertiary ? 0.5 : 0.2;
    const predicted = predictedAesthetics[a];
    const score = Number(
      (target * predicted * 0.5 + Math.min(target, predicted) * 0.5).toFixed(2),
    );
    matchScores[a] = score;
  }

  const primaryMatch = matchScores[aesthetics.primary] || 0;
  const secondaryMatch = matchScores[aesthetics.secondary] || 0;
  const overallMatch = Number(
    (primaryMatch * 0.6 + secondaryMatch * 0.4).toFixed(3),
  );

  // Observed dynamics: dynamics whose mechanics appear in the set.
  const allDynamics = [
    ...AESTHETIC_TO_DYNAMICS[aesthetics.primary] || [],
    ...AESTHETIC_TO_DYNAMICS[aesthetics.secondary] || [],
    ...AESTHETIC_TO_DYNAMICS[aesthetics.tertiary] || [],
  ];
  const observedDynamics = allDynamics.filter((dyn) => {
    const mechs = DYNAMICS_TO_MECHANICS[dyn] || [];
    return mechs.some((m) => allMechs.includes(m));
  });

  return {
    predicted_aesthetics: predictedAesthetics,
    match_scores: matchScores,
    overall_match: overallMatch,
    converged: false, // set by the loop, not the single pass
    observed_dynamics: observedDynamics,
  };
}

/**
 * Find the best candidate mechanic to add for improving the weakest target
 * aesthetic. Returns the mechanic name, or null if no candidate is available.
 *
 * Strategy: take the target aesthetic with the lowest match score (among
 * primary/secondary/tertiary), look up its dynamics, collect mechanics from
 * those dynamics that are NOT yet in the set, and return the first one.
 */
function findCandidateForWeakestAesthetic(
  mechanicSet: MechanicSetForMda,
  aesthetics: AestheticsTarget,
  matchScores: Record<string, number>,
): { mechanic: string; aesthetic: string } | null {
  const currentMechs = new Set(mechanicNames(mechanicSet));
  const targets = [aesthetics.primary, aesthetics.secondary, aesthetics.tertiary]
    .filter((a) => a && a.trim());

  // Sort targets by match score ascending (weakest first).
  const sorted = targets
    .map((aesthetic) => ({ aesthetic, score: matchScores[aesthetic] ?? 0 }))
    .sort((a, b) => a.score - b.score);

  for (const { aesthetic } of sorted) {
    const dynamics = AESTHETIC_TO_DYNAMICS[aesthetic] || [];
    for (const dyn of dynamics) {
      const mechs = DYNAMICS_TO_MECHANICS[dyn] || [];
      for (const m of mechs) {
        if (!currentMechs.has(m)) {
          return { mechanic: m, aesthetic };
        }
      }
    }
  }

  return null;
}

/**
 * Run the MDA iteration loop: evaluate → (if below threshold) add a mechanic
 * for the weakest aesthetic → re-evaluate → record diff → repeat.
 *
 * @param initialMechanicSet   The starting mechanic set (from buildMechanicSet).
 * @param aesthetics           Target aesthetics (primary/secondary/tertiary).
 * @param convergenceThreshold Minimum overall_match to consider converged.
 * @param maxIterations        Maximum iterations (default 5).
 * @returns IterationLoopResult with real iteration count, diffs and final set.
 */
export function runMdaIterationLoop(
  initialMechanicSet: MechanicSetForMda,
  aesthetics: AestheticsTarget,
  convergenceThreshold: number,
  maxIterations = 5,
): IterationLoopResult {
  const diffs: IterationDiff[] = [];
  let currentSet = cloneMechanicSet(initialMechanicSet);

  // Iteration 1: evaluate the initial set.
  let evaluation = evaluateMdaPass(currentSet, aesthetics);
  let overallMatch = evaluation.overall_match;

  // Already converged on the first pass?
  if (overallMatch >= convergenceThreshold) {
    evaluation.converged = true;
    return {
      ...evaluation,
      iterations: 1,
      iteration_diffs: [{
        iteration: 1,
        added_mechanic: null,
        added_to_category: null,
        target_aesthetic: null,
        overall_match_before: overallMatch,
        overall_match_after: overallMatch,
        converged: true,
      }],
      final_mechanic_set: currentSet,
      converged: true,
      termination_reason: "already_converged",
    };
  }

  // Iteration loop: add mechanics until converged or max reached.
  let iteration = 1;
  let lastTermination: IterationLoopResult["termination_reason"] = "max_iterations";

  while (iteration < maxIterations) {
    const candidate = findCandidateForWeakestAesthetic(
      currentSet,
      aesthetics,
      evaluation.match_scores,
    );

    if (!candidate) {
      lastTermination = "no_candidates";
      break;
    }

    const matchBefore = overallMatch;
    const addedCategory = addMechanicToSet(currentSet, candidate.mechanic);

    if (addedCategory === null) {
      // Already present (shouldn't happen — findCandidate filters), skip.
      lastTermination = "no_candidates";
      break;
    }

    // Re-evaluate after adding the mechanic.
    evaluation = evaluateMdaPass(currentSet, aesthetics);
    overallMatch = evaluation.overall_match;
    iteration += 1;

    const converged = overallMatch >= convergenceThreshold;
    diffs.push({
      iteration,
      added_mechanic: candidate.mechanic,
      added_to_category: addedCategory,
      target_aesthetic: candidate.aesthetic,
      overall_match_before: Number(matchBefore.toFixed(3)),
      overall_match_after: Number(overallMatch.toFixed(3)),
      converged,
    });

    if (converged) {
      evaluation.converged = true;
      lastTermination = "converged";
      break;
    }
  }

  return {
    ...evaluation,
    iterations: iteration,
    iteration_diffs: diffs,
    final_mechanic_set: currentSet,
    converged: evaluation.converged,
    termination_reason: lastTermination,
  };
}
