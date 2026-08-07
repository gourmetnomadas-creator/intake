'use client';

import { useState } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { buildTrendPath, logsInRange, TrendRange } from '@/lib/calculations';

interface WeightTrendChartProps {
  logs: { date: string; weight_kg: number }[];
  goalWeight?: number | null;
}

const RANGES: { key: TrendRange; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

// Driven by the span actually plotted, not by the selected range: picking
// 'MMM' just because "Year" is active renders "Aug Aug Aug" when the user only
// has a few days of history.
function labelFormat(spanDays: number): string {
  if (spanDays <= 8) return 'EEEEE';
  if (spanDays <= 90) return 'd MMM';
  return 'MMM';
}

const W = 300;
const H = 54;
const MAX_LABELS = 7;

export default function WeightTrendChart({ logs, goalWeight = null }: WeightTrendChartProps) {
  const [range, setRange] = useState<TrendRange>('week');

  const entries = logsInRange(logs, range).sort((a, b) => a.date.localeCompare(b.date));
  const values = entries.map((e) => e.weight_kg);
  // The goal deliberately does not widen the scale — over a week it would
  // squash the actual movement flat. Draw its line only when it's in view.
  const chart = buildTrendPath(values, { width: W, height: H, padTop: 8, padBottom: 8 });
  const goalInView =
    goalWeight != null &&
    values.length > 0 &&
    goalWeight >= Math.min(...values) &&
    goalWeight <= Math.max(...values);

  // Evenly-spaced labels so a year of daily weigh-ins doesn't render 365 of them.
  const step = Math.max(1, Math.ceil(entries.length / MAX_LABELS));
  const labels = entries.filter((_, i) => i % step === 0);
  const spanDays = entries.length
    ? differenceInCalendarDays(
        parseISO(entries[entries.length - 1].date),
        parseISO(entries[0].date)
      )
    : 0;
  const fmt = labelFormat(spanDays);

  return (
    <div>
      <div className="flex rounded-full bg-slate-100 p-[3px]">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            aria-pressed={range === r.key}
            className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition ${
              range === r.key ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {chart ? (
        <>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            height={H}
            preserveAspectRatio="none"
            className="mt-3 block overflow-visible"
          >
            {goalInView && (
              <line
                x1="0"
                y1={chart.yAt(goalWeight!)}
                x2={W}
                y2={chart.yAt(goalWeight!)}
                stroke="#b8bcb8"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
            )}
            <path d={chart.area} fill="#1E6F63" fillOpacity="0.12" />
            <path
              d={chart.line}
              fill="none"
              stroke="#1E6F63"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx={chart.points[chart.points.length - 1][0]}
              cy={chart.points[chart.points.length - 1][1]}
              r="4"
              fill="#fff"
              stroke="#1E6F63"
              strokeWidth="2.5"
            />
          </svg>
          <div className="mt-1.5 flex justify-between">
            {labels.map((e) => (
              <span key={e.date} className="text-[10px] text-slate-400">
                {format(parseISO(e.date), fmt)}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-4 text-center text-xs text-slate-400">
          No weigh-ins in this range yet.
        </p>
      )}
    </div>
  );
}
