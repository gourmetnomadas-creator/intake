'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { GLASS_ML } from '@/lib/calculations';

/**
 * Today's water as glasses toward the daily target. One row per user per day,
 * so tapping +/- upserts the running total rather than appending events.
 */
export default function WaterCard({
  userId,
  targetMl,
  date,
}: {
  userId: string;
  targetMl: number;
  date?: string;
}) {
  const [ml, setMl] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const day = date ?? new Date().toISOString().split('T')[0];

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('water_logs')
      .select('ml')
      .eq('user_id', userId)
      .eq('date', day)
      .maybeSingle()
      .then(({ data }: { data: { ml: number } | null }) => {
        setMl(data?.ml ?? 0);
        setLoaded(true);
      });
  }, [userId, day]);

  const change = async (delta: number) => {
    const next = Math.max(0, ml + delta);
    setMl(next); // optimistic
    const supabase = createClient();
    const { error } = await supabase
      .from('water_logs')
      .upsert(
        { user_id: userId, date: day, ml: next, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,date' }
      );
    if (error) setMl(ml); // put it back if the write failed
  };

  if (!loaded) return null;

  const pct = Math.min((ml / targetMl) * 100, 100);
  const litres = (n: number) => (n / 1000).toFixed(1).replace(/\.0$/, '');

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Water</p>
        <p className="text-sm text-slate-400">
          <span className="font-semibold text-slate-900">{litres(ml)}</span> / {litres(targetMl)} L
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => change(-GLASS_ML)}
          disabled={ml === 0}
          aria-label="Remove a glass of water"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg text-slate-500 transition disabled:opacity-40"
        >
          –
        </button>

        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-400 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        <button
          onClick={() => change(GLASS_ML)}
          aria-label="Add a glass of water"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500 text-lg text-white transition hover:bg-indigo-600"
        >
          +
        </button>
      </div>

      <p className="mt-2 text-[11px] text-slate-400">
        {Math.round(ml / GLASS_ML)} of {Math.round(targetMl / GLASS_ML)} glasses · {GLASS_ML} ml each
      </p>
    </div>
  );
}
