// Is the goal actually working? Everything here is arithmetic over data the
// app already stores — no model involved, so these numbers cannot drift or
// hallucinate the way a generated summary can.

import { logsWithinDays } from './calculations';

export interface WeightRate {
  kgPerWeek: number;
  percentPerWeek: number;
  entries: number;
  spanDays: number;
}

// Below this there is not enough signal to separate a trend from noise.
export const MIN_RATE_ENTRIES = 3;
export const MIN_RATE_SPAN_DAYS = 7;

/**
 * Rate of weight change over the window, from a least-squares fit.
 *
 * A regression rather than first-minus-last: with the latter a single odd
 * weigh-in at either end sets the whole rate, and body weight swings a
 * kilogram on water alone.
 */
export function weightChangeRate(
  logs: { date: string; weight_kg: number }[],
  windowDays = 28,
  today: Date = new Date()
): WeightRate | null {
  const window = logsWithinDays(logs, windowDays, today);
  if (window.length < MIN_RATE_ENTRIES) return null;

  const days = window.map((log) => new Date(`${log.date}T00:00:00`).getTime() / 86_400_000);
  const weights = window.map((log) => log.weight_kg);

  const spanDays = Math.max(...days) - Math.min(...days);
  if (spanDays < MIN_RATE_SPAN_DAYS) return null;

  const meanDay = days.reduce((a, b) => a + b, 0) / days.length;
  const meanWeight = weights.reduce((a, b) => a + b, 0) / weights.length;

  let covariance = 0;
  let variance = 0;
  for (let i = 0; i < days.length; i++) {
    covariance += (days[i] - meanDay) * (weights[i] - meanWeight);
    variance += (days[i] - meanDay) ** 2;
  }
  if (variance === 0 || meanWeight === 0) return null;

  const kgPerDay = covariance / variance;
  const kgPerWeek = kgPerDay * 7;

  return {
    kgPerWeek: Math.round(kgPerWeek * 100) / 100,
    percentPerWeek: Math.round((kgPerWeek / meanWeight) * 1000) / 10,
    entries: window.length,
    spanDays: Math.round(spanDays),
  };
}

export interface RateBand {
  /** Signed percent of body weight per week; negative means losing. */
  min: number;
  max: number;
  /** How the range is usually described, for showing next to the number. */
  label: string;
}

/**
 * The rate commonly cited for each goal, as a reference to show beside the
 * measured one. These are general figures, not a target set for this person.
 */
export function goalRateBand(goalType: string | null | undefined): RateBand | null {
  switch (goalType) {
    case 'lose':
      return { min: -1, max: -0.5, label: '0.5–1% of body weight per week' };
    case 'mild_deficit':
      return { min: -0.5, max: -0.25, label: '0.25–0.5% of body weight per week' };
    case 'maintain':
      return { min: -0.25, max: 0.25, label: 'within 0.25% either way' };
    case 'mild_surplus':
      return { min: 0.1, max: 0.3, label: '0.1–0.3% of body weight per week' };
    case 'gain':
      return { min: 0.25, max: 0.5, label: '0.25–0.5% of body weight per week' };
    // "manual" means the user set their own calorie target, so there is no
    // matching rate to compare against.
    default:
      return null;
  }
}

export type RateStatus = 'within' | 'above' | 'below' | 'opposite';

/** Where the measured rate sits relative to the cited range. */
export function assessRate(percentPerWeek: number, band: RateBand): RateStatus {
  if (percentPerWeek >= band.min && percentPerWeek <= band.max) return 'within';

  // A band that stays one side of zero has a direction to move against.
  const losing = band.max < 0;
  const gaining = band.min > 0;
  if (losing && percentPerWeek > 0) return 'opposite';
  if (gaining && percentPerWeek < 0) return 'opposite';

  return Math.abs(percentPerWeek) > Math.abs(losing ? band.min : band.max) ? 'above' : 'below';
}

export interface ProteinIntake {
  averageDailyG: number;
  perKg: number | null;
  daysCounted: number;
}

/**
 * Average protein per logged day, and per kilogram of body weight.
 *
 * Averaged over days that were actually logged: dividing by the window would
 * report a shortfall for days the user simply did not record.
 */
export function averageDailyProtein(
  meals: { date: string; total_protein_g: number }[],
  windowDays: number,
  weightKg: number | null,
  today: Date = new Date()
): ProteinIntake | null {
  const window = logsWithinDays(meals, windowDays, today);
  if (window.length === 0) return null;

  const byDay = new Map<string, number>();
  for (const meal of window) {
    byDay.set(meal.date, (byDay.get(meal.date) ?? 0) + meal.total_protein_g);
  }

  const daysCounted = byDay.size;
  const total = [...byDay.values()].reduce((a, b) => a + b, 0);
  const averageDailyG = Math.round(total / daysCounted);

  return {
    averageDailyG,
    perKg: weightKg ? Math.round((averageDailyG / weightKg) * 10) / 10 : null,
    daysCounted,
  };
}

// The figure the app already uses to set a protein target at onboarding.
export const PROTEIN_REFERENCE_G_PER_KG = 1.6;

/** How many of the last N days have at least one meal on them. */
export function loggingAdherence(
  meals: { date: string }[],
  windowDays: number,
  today: Date = new Date()
): { daysLogged: number; windowDays: number } {
  const window = logsWithinDays(meals, windowDays, today);
  return { daysLogged: new Set(window.map((m) => m.date)).size, windowDays };
}
