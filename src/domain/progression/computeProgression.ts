import { convertWeight, defaultStep, floorToStep, roundTo, roundToStep } from '@/utils/units';
import { evaluateSession, type SessionEval } from './evaluate';
import type { Prescription, ProgressionInput, ProgressionResult, ReasonCode } from './types';

function fmt(n: number): string {
  const r = roundTo(n, 2);
  return Number.isInteger(r) ? String(r) : String(r);
}

function blockedByReadiness(readiness: ProgressionInput['readiness']): boolean {
  return readiness === 'tired' || readiness === 'sore' || readiness === 'rest';
}

function emptyPrescription(input: ProgressionInput): Prescription {
  const t = input.target;
  switch (input.exercise.kind) {
    case 'weighted':
      return {
        kind: 'weighted',
        weight: null,
        unit: input.displayUnit,
        targetSets: t.targetSets,
        minReps: t.minReps,
        maxReps: t.maxReps,
      };
    case 'bodyweight':
      return { kind: 'bodyweight', targetReps: null, targetSets: t.targetSets };
    case 'timed':
      return { kind: 'timed', durationSeconds: t.targetDurationSeconds, targetSets: t.targetSets };
    case 'cardio':
      return {
        kind: 'cardio',
        durationSeconds: t.targetDurationSeconds,
        distance: t.targetDistance,
        suggestion: null,
      };
  }
}

function result(
  input: ProgressionInput,
  action: ProgressionResult['action'],
  reasonCode: ReasonCode,
  reason: string,
  prescription: Prescription,
  ev: SessionEval | null,
  sessionId: string | null,
): ProgressionResult {
  return {
    action,
    reasonCode,
    reason,
    prescription,
    basedOn:
      ev && sessionId
        ? {
            sessionId,
            topLoad: ev.topLoad === null ? null : roundTo(ev.topLoad, 2),
            unit: input.displayUnit,
            setsAtMax: ev.setsAtMax,
            setsCompleted: ev.completed.length,
          }
        : null,
  };
}

/**
 * Double progression: hold the load until every working set reaches the top of the rep range, then add
 * the configured increment. Pure and deterministic; every branch explains itself.
 */
export function computeProgression(input: ProgressionInput): ProgressionResult {
  const { exercise, target, displayUnit, readiness } = input;
  const kind = exercise.kind;
  const step = input.roundTo ?? defaultStep(displayUnit);
  const last = input.history[0] ?? null;
  const prev = input.history[1] ?? null;

  if (!last) {
    const hint =
      kind === 'weighted'
        ? `Start conservatively with a weight you can lift for ${target.maxReps} clean reps.`
        : kind === 'bodyweight'
          ? `Aim for ${target.minReps}–${target.maxReps} reps per set and log what you get.`
          : kind === 'timed'
            ? `Hold for as long as you can with good form and log the time.`
            : `Log your time and distance; progress will build from there.`;
    return result(
      input,
      'review',
      'NO_HISTORY',
      `No previous sessions for this exercise. ${hint}`,
      emptyPrescription(input),
      null,
      null,
    );
  }

  const ev = evaluateSession(last, target, kind, displayUnit);
  if (ev.working.length === 0 || ev.completed.length === 0) {
    return result(
      input,
      'review',
      'NO_WORKING_SETS',
      'Only warm-up or incomplete sets were logged last time. Repeat the workout and log your working sets.',
      emptyPrescription(input),
      ev,
      last.sessionId,
    );
  }

  if (kind === 'cardio') {
    let maxDuration: number | null = null;
    let maxDistance: number | null = null;
    for (const s of ev.completed) {
      if (s.durationSeconds !== null && (maxDuration === null || s.durationSeconds > maxDuration))
        maxDuration = s.durationSeconds;
      if (s.distance !== null && (maxDistance === null || s.distance > maxDistance)) maxDistance = s.distance;
    }
    if (blockedByReadiness(readiness)) {
      return result(
        input,
        'maintain',
        'CARDIO_HOLD',
        `Keep the same duration and distance today; you reported feeling ${readiness}.`,
        { kind: 'cardio', durationSeconds: maxDuration, distance: maxDistance, suggestion: null },
        ev,
        last.sessionId,
      );
    }
    return result(
      input,
      'maintain',
      'CARDIO_SUGGEST',
      'Cardio progresses gradually: try 5–10% more time or distance when it feels comfortable.',
      {
        kind: 'cardio',
        durationSeconds: maxDuration,
        distance: maxDistance,
        suggestion: {
          durationSeconds:
            maxDuration === null ? null : [Math.round(maxDuration * 1.05), Math.round(maxDuration * 1.1)],
          distance: maxDistance === null ? null : [roundTo(maxDistance * 1.05, 2), roundTo(maxDistance * 1.1, 2)],
        },
      },
      ev,
      last.sessionId,
    );
  }

  if (kind === 'timed' && !target.targetDurationSeconds) {
    return result(
      input,
      'review',
      'NO_TARGET_DURATION',
      'No target duration is configured for this exercise. Set one in the routine to get progression advice.',
      emptyPrescription(input),
      ev,
      last.sessionId,
    );
  }

  const blocked = blockedByReadiness(readiness);
  const prevEval = prev ? evaluateSession(prev, target, kind, displayUnit) : null;

  type Decision = { action: ProgressionResult['action']; code: ReasonCode };
  let decision: Decision;
  if (ev.failed) {
    if (prevEval && prevEval.failed) decision = { action: 'decrease', code: 'FAILED_TWO_SESSIONS' };
    else if (!prevEval) decision = { action: 'review', code: 'FAILED_ONCE_NO_HISTORY' };
    else decision = { action: 'maintain', code: 'FAILED_ONCE_PRIOR_OK' };
  } else if (ev.allAtMax) {
    decision = blocked
      ? { action: 'maintain', code: 'READINESS_BLOCKS_INCREASE' }
      : { action: 'increase', code: 'ALL_SETS_AT_MAX' };
  } else {
    decision = { action: 'maintain', code: 'NOT_ALL_SETS_AT_MAX' };
  }

  // ---- weighted ----
  if (kind === 'weighted') {
    const current = ev.topLoad ?? 0;
    const unit = displayUnit;
    const incRaw = convertWeight(target.progressionIncrement, target.incrementUnit, unit);
    const inc = Math.max(step, roundToStep(incRaw, step));
    const minLoad =
      exercise.minLoad !== null && exercise.minLoadUnit
        ? convertWeight(exercise.minLoad, exercise.minLoadUnit, unit)
        : null;
    const clampMin = (v: number) => (minLoad !== null ? Math.max(v, roundToStep(minLoad, step)) : v);
    const presc = (weight: number): Prescription => ({
      kind: 'weighted',
      weight: roundTo(weight, 3),
      unit,
      targetSets: target.targetSets,
      minReps: target.minReps,
      maxReps: target.maxReps,
    });
    const setsText = `${ev.setsAtMax} of ${ev.completed.length} working sets reached ${target.maxReps} reps at ${fmt(current)} ${unit}`;

    switch (decision.code) {
      case 'ALL_SETS_AT_MAX': {
        const next = clampMin(roundToStep(current + inc, step));
        return result(
          input,
          'increase',
          decision.code,
          `All ${ev.completed.length} working sets hit ${target.maxReps} reps at ${fmt(current)} ${unit}. Add ${fmt(inc)} ${unit} → ${fmt(next)} ${unit}.`,
          presc(next),
          ev,
          last.sessionId,
        );
      }
      case 'READINESS_BLOCKS_INCREASE':
        return result(
          input,
          'maintain',
          decision.code,
          `You hit ${target.targetSets}×${target.maxReps} at ${fmt(current)} ${unit}, but you're feeling ${readiness}. Hold the load today and increase next time.`,
          presc(current),
          ev,
          last.sessionId,
        );
      case 'NOT_ALL_SETS_AT_MAX':
        return result(
          input,
          'maintain',
          decision.code,
          `${setsText}. Keep the load until every set hits ${target.maxReps}.`,
          presc(current),
          ev,
          last.sessionId,
        );
      case 'FAILED_ONCE_NO_HISTORY':
        return result(
          input,
          'review',
          decision.code,
          `Reps fell short of ${target.minReps} at ${fmt(current)} ${unit}, but one session isn't a trend. Repeat the same load and reassess.`,
          presc(current),
          ev,
          last.sessionId,
        );
      case 'FAILED_ONCE_PRIOR_OK':
        return result(
          input,
          'maintain',
          decision.code,
          `Reps fell short last time at ${fmt(current)} ${unit}, but you hit the range before. Repeat the same load.`,
          presc(current),
          ev,
          last.sessionId,
        );
      case 'FAILED_TWO_SESSIONS': {
        const candidate = floorToStep(current * 0.9, step);
        const next = clampMin(candidate);
        if (minLoad !== null && next >= current) {
          return result(
            input,
            'decrease',
            'AT_MIN_LOAD',
            `Reps fell short twice, but you're already at the minimum load (${fmt(minLoad)} ${unit}). Reduce reps per set or switch to an easier variation.`,
            presc(roundToStep(minLoad, step)),
            ev,
            last.sessionId,
          );
        }
        return result(
          input,
          'decrease',
          decision.code,
          `Reps fell below ${target.minReps - 2} (or fewer than half the sets were completed) in the last two sessions. Drop about 10% to ${fmt(next)} ${unit} and rebuild.`,
          presc(next),
          ev,
          last.sessionId,
        );
      }
      default:
        return result(input, 'maintain', 'NOT_ALL_SETS_AT_MAX', setsText, presc(current), ev, last.sessionId);
    }
  }

  // ---- bodyweight ----
  if (kind === 'bodyweight') {
    const incReps = Math.max(1, Math.round(target.progressionIncrement || 1));
    const presc = (targetReps: number): Prescription => ({
      kind: 'bodyweight',
      targetReps,
      targetSets: target.targetSets,
    });
    switch (decision.code) {
      case 'ALL_SETS_AT_MAX':
        return result(
          input,
          'increase',
          decision.code,
          `All ${ev.completed.length} sets hit ${target.maxReps} reps. Add reps: aim for ${target.maxReps + incReps} per set, or add load if available.`,
          presc(target.maxReps + incReps),
          ev,
          last.sessionId,
        );
      case 'READINESS_BLOCKS_INCREASE':
        return result(
          input,
          'maintain',
          decision.code,
          `You hit ${target.targetSets}×${target.maxReps}, but you're feeling ${readiness}. Repeat the same reps today.`,
          presc(target.maxReps),
          ev,
          last.sessionId,
        );
      case 'NOT_ALL_SETS_AT_MAX':
        return result(
          input,
          'maintain',
          decision.code,
          `${ev.setsAtMax} of ${ev.completed.length} sets reached ${target.maxReps} reps. Keep working toward ${target.maxReps} on every set.`,
          presc(target.maxReps),
          ev,
          last.sessionId,
        );
      case 'FAILED_ONCE_NO_HISTORY':
        return result(
          input,
          'review',
          decision.code,
          `Reps fell short of ${target.minReps}, but one session isn't a trend. Repeat and reassess.`,
          presc(target.maxReps),
          ev,
          last.sessionId,
        );
      case 'FAILED_ONCE_PRIOR_OK':
        return result(
          input,
          'maintain',
          decision.code,
          `Reps fell short last time but you hit the range before. Repeat the same target.`,
          presc(target.maxReps),
          ev,
          last.sessionId,
        );
      case 'FAILED_TWO_SESSIONS':
        return result(
          input,
          'decrease',
          decision.code,
          `Reps fell well short in the last two sessions. Aim for ${target.minReps} per set, or use an easier variation (band assist, incline).`,
          presc(target.minReps),
          ev,
          last.sessionId,
        );
      default:
        return result(input, 'maintain', 'NOT_ALL_SETS_AT_MAX', 'Keep going.', presc(target.maxReps), ev, last.sessionId);
    }
  }

  // ---- timed ----
  const goal = target.targetDurationSeconds ?? 0;
  const incSec = Math.max(1, Math.round(target.progressionIncrement || 10));
  const presc = (durationSeconds: number): Prescription => ({
    kind: 'timed',
    durationSeconds,
    targetSets: target.targetSets,
  });
  switch (decision.code) {
    case 'ALL_SETS_AT_MAX':
      return result(
        input,
        'increase',
        decision.code,
        `All ${ev.completed.length} sets held ${goal}s. Add ${incSec}s → ${goal + incSec}s.`,
        presc(goal + incSec),
        ev,
        last.sessionId,
      );
    case 'READINESS_BLOCKS_INCREASE':
      return result(
        input,
        'maintain',
        decision.code,
        `You held ${goal}s on every set, but you're feeling ${readiness}. Keep ${goal}s today.`,
        presc(goal),
        ev,
        last.sessionId,
      );
    case 'NOT_ALL_SETS_AT_MAX':
      return result(
        input,
        'maintain',
        decision.code,
        `${ev.setsAtMax} of ${ev.completed.length} sets held the full ${goal}s. Keep the target until every set does.`,
        presc(goal),
        ev,
        last.sessionId,
      );
    case 'FAILED_ONCE_NO_HISTORY':
      return result(
        input,
        'review',
        decision.code,
        `Times fell short of ${goal}s, but one session isn't a trend. Repeat and reassess.`,
        presc(goal),
        ev,
        last.sessionId,
      );
    case 'FAILED_ONCE_PRIOR_OK':
      return result(
        input,
        'maintain',
        decision.code,
        `Times fell short last time but you hit ${goal}s before. Keep the same target.`,
        presc(goal),
        ev,
        last.sessionId,
      );
    case 'FAILED_TWO_SESSIONS': {
      const next = Math.max(10, goal - incSec);
      return result(
        input,
        'decrease',
        decision.code,
        `Times fell well short in the last two sessions. Reduce the target to ${next}s and rebuild.`,
        presc(next),
        ev,
        last.sessionId,
      );
    }
    default:
      return result(input, 'maintain', 'NOT_ALL_SETS_AT_MAX', 'Keep going.', presc(goal), ev, last.sessionId);
  }
}
