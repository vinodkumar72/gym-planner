import type { DistanceUnit, WeightUnit } from '@/domain/models/types';

export const KG_PER_LB = 0.45359237;
export const KM_PER_MI = 1.609344;

/** Round to a fixed number of decimals without binary drift (e.g. 0.1 + 0.2). */
export function roundTo(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === 'lb' ? value * KG_PER_LB : value / KG_PER_LB;
}

export function convertDistance(value: number, from: DistanceUnit, to: DistanceUnit): number {
  if (from === to) return value;
  return from === 'mi' ? value * KM_PER_MI : value / KM_PER_MI;
}

/** Display conversion rounded to 2 decimals. */
export function displayWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  return roundTo(convertWeight(value, from, to), 2);
}

/** Smallest plate step used by the progression engine for snapping suggested loads. */
export function defaultStep(unit: WeightUnit): number {
  return unit === 'kg' ? 1.25 : 2.5;
}

/**
 * Step for the +/- weight control during a workout: the exercise's configured progression increment,
 * converted to the display unit and snapped to a plate step (never below 2.5 lb / 1.25 kg).
 */
export function stepperStep(increment: number, incrementUnit: WeightUnit, displayUnit: WeightUnit): number {
  const plate = defaultStep(displayUnit);
  const converted = convertWeight(increment > 0 ? increment : 5, incrementUnit, displayUnit);
  return Math.max(plate, roundToStep(converted, plate));
}

/** Snap to the nearest multiple of step, computed in integer thousandths to avoid float drift. */
export function roundToStep(value: number, step: number): number {
  if (step <= 0) return roundTo(value, 3);
  const v = Math.round(value * 1000);
  const s = Math.round(step * 1000);
  return (Math.round(v / s) * s) / 1000;
}

export function floorToStep(value: number, step: number): number {
  if (step <= 0) return roundTo(value, 3);
  const v = Math.round(value * 1000);
  const s = Math.round(step * 1000);
  return (Math.floor(v / s) * s) / 1000;
}

export function formatWeight(value: number | null | undefined, unit: WeightUnit): string {
  if (value === null || value === undefined) return '—';
  const r = roundTo(value, 2);
  return `${Number.isInteger(r) ? r : r.toFixed(r * 10 === Math.floor(r * 10) ? 1 : 2)} ${unit}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.max(0, seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
