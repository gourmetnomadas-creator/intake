'use client';

import { Meal, BodyWeightLog, Profile } from '@/types';
import {
  weightChangeRate,
  goalRateBand,
  assessRate,
  averageDailyProtein,
  loggingAdherence,
  PROTEIN_REFERENCE_G_PER_KG,
  type RateStatus,
} from '@/lib/progress';

const WINDOW_DAYS = 28;

// Neutral wording on purpose: the card reports where the number sits against a
// commonly cited range. Telling someone to eat more or less is a different job.
const STATUS_TEXT: Record<RateStatus, string> = {
  within: 'In the usual range',
  above: 'Faster than the usual range',
  below: 'Slower than the usual range',
  opposite: 'Moving the other way',
};

const STATUS_STYLE: Record<RateStatus, string> = {
  within: 'bg-emerald-50 text-emerald-700',
  above: 'bg-amber-50 text-amber-700',
  below: 'bg-amber-50 text-amber-700',
  opposite: 'bg-amber-50 text-amber-700',
};

const signed = (value: number, digits = 1) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(digits)}`;

interface GoalProgressCardProps {
  profile: Profile | null;
  meals: Meal[];
  weightLogs: BodyWeightLog[];
}

export default function GoalProgressCard({ profile, meals, weightLogs }: GoalProgressCardProps) {
  const rate = weightChangeRate(weightLogs, WINDOW_DAYS);
  const band = goalRateBand(profile?.goal_type);
  const status = rate && band ? assessRate(rate.percentPerWeek, band) : null;

  const weight = profile?.current_weight_kg ?? null;
  const protein = averageDailyProtein(meals, WINDOW_DAYS, weight);
  const adherence = loggingAdherence(meals, WINDOW_DAYS);

  return (
    <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-slate-700">📐 Is it working?</p>
        <span className="text-[11px] text-slate-400">Last {WINDOW_DAYS} days</span>
      </div>

      {/* Weight trend */}
      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-slate-500">Weight trend</span>
          {status && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status]}`}>
              {STATUS_TEXT[status]}
            </span>
          )}
        </div>

        {rate ? (
          <>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {signed(rate.percentPerWeek)}% <span className="text-sm font-medium text-slate-400">per week</span>
            </p>
            <p className="text-xs text-slate-400">
              {signed(rate.kgPerWeek, 2)} kg per week, from {rate.entries} weigh-ins over{' '}
              {rate.spanDays} days
            </p>
            {band && (
              <p className="mt-1 text-xs text-slate-400">
                Commonly cited for this goal: {band.label}.
              </p>
            )}
            {!band && (
              <p className="mt-1 text-xs text-slate-400">
                Set a goal in your profile to see this next to a reference range.
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-xs text-slate-400">
            Needs at least 3 weigh-ins spread over a week before a trend means anything.
          </p>
        )}
      </div>

      {/* Protein */}
      <div className="mt-3 border-t border-slate-100 pt-3">
        <span className="text-xs font-medium text-slate-500">Protein</span>
        {protein ? (
          <>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {protein.averageDailyG} g
              <span className="text-sm font-medium text-slate-400"> per logged day</span>
            </p>
            <p className="text-xs text-slate-400">
              {protein.perKg != null
                ? `${protein.perKg} g per kg of body weight · ${PROTEIN_REFERENCE_G_PER_KG} g/kg is the figure this app uses to set your target`
                : `Averaged over ${protein.daysCounted} logged days`}
            </p>
          </>
        ) : (
          <p className="mt-1 text-xs text-slate-400">No meals logged in this period yet.</p>
        )}
      </div>

      {/* Adherence */}
      <div className="mt-3 border-t border-slate-100 pt-3">
        <span className="text-xs font-medium text-slate-500">Days logged</span>
        <p className="mt-1 text-lg font-bold text-slate-900">
          {adherence.daysLogged}
          <span className="text-sm font-medium text-slate-400"> of {adherence.windowDays}</span>
        </p>
        <p className="text-xs text-slate-400">
          The numbers above only describe the days you recorded.
        </p>
      </div>

      <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-400">
        These are general figures for context, not advice for you specifically.
      </p>
    </div>
  );
}
