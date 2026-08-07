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

const ACCENT = '#1f6f57';

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
      <div style={{ display: 'flex', background: '#f2eee7', borderRadius: 999, padding: 3 }}>
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            aria-pressed={range === r.key}
            style={{
              flex: 1,
              padding: '7px 0',
              borderRadius: 999,
              font: '600 12px -apple-system,sans-serif',
              cursor: 'pointer',
              border: 'none',
              background: range === r.key ? ACCENT : 'transparent',
              color: range === r.key ? '#ffffff' : '#6b6b60',
            }}
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
            style={{ display: 'block', marginTop: 12, overflow: 'visible' }}
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
            <path d={chart.area} fill={ACCENT} fillOpacity="0.12" />
            <path
              d={chart.line}
              fill="none"
              stroke={ACCENT}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx={chart.points[chart.points.length - 1][0]}
              cy={chart.points[chart.points.length - 1][1]}
              r="4"
              fill="#fff"
              stroke={ACCENT}
              strokeWidth="2.5"
            />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            {labels.map((e) => (
              <span key={e.date} style={{ font: '500 10px -apple-system,sans-serif', color: '#b0aa9c' }}>
                {format(parseISO(e.date), fmt)}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p style={{ font: '400 12px -apple-system,sans-serif', color: '#b0aa9c', textAlign: 'center', margin: '16px 0 0' }}>
          No weigh-ins in this range yet.
        </p>
      )}
    </div>
  );
}
