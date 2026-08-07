'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Supplement, TimeOfDay } from '@/types';
import { timeOfDayLabels } from '@/lib/utils';

const timeOrder: TimeOfDay[] = ['morning', 'midday', 'evening', 'night'];

export default function SupplementsCard({
  userId,
  date,
  compact = false,
}: {
  userId: string;
  date?: string;
  compact?: boolean;
}) {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [takenIds, setTakenIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const day = date ?? new Date().toISOString().split('T')[0];

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from('supplements').select('*').eq('user_id', userId).order('created_at'),
      supabase.from('supplement_logs').select('supplement_id').eq('user_id', userId).eq('date', day),
    ]).then(([supsRes, logsRes]) => {
      if (supsRes.data) setSupplements(supsRes.data);
      if (logsRes.data) {
        setTakenIds(new Set(logsRes.data.map((l: any) => l.supplement_id)));
      }
      setLoaded(true);
    });
  }, [userId, day]);

  const toggle = async (supplement: Supplement) => {
    const supabase = createClient();
    const isTaken = takenIds.has(supplement.id);

    // optimistic update
    setTakenIds((prev) => {
      const next = new Set(prev);
      if (isTaken) next.delete(supplement.id);
      else next.add(supplement.id);
      return next;
    });

    if (isTaken) {
      await supabase
        .from('supplement_logs')
        .delete()
        .eq('supplement_id', supplement.id)
        .eq('date', day);
    } else {
      await supabase.from('supplement_logs').insert({
        user_id: userId,
        supplement_id: supplement.id,
        date: day,
      });
    }
  };

  if (!loaded) return null;

  if (supplements.length === 0) {
    if (compact) return null;
    return (
      <div className="mt-6 text-center">
        <Link href="/supplements" className="text-xs font-medium text-indigo-500 hover:text-indigo-600">
          + Track your supplements
        </Link>
      </div>
    );
  }

  const takenCount = supplements.filter((s) => takenIds.has(s.id)).length;
  const groups = timeOrder
    .map((time) => ({ time, items: supplements.filter((s) => s.time_of_day === time) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className={`rounded-2xl bg-white p-4 shadow-sm ${compact ? '' : 'mt-6'}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">
          Supplements{' '}
          <span className="font-normal text-slate-400">
            {takenCount}/{supplements.length}
          </span>
        </h3>
        {!compact && (
          <Link href="/supplements" className="text-xs font-medium text-indigo-500 hover:text-indigo-600">
            Manage
          </Link>
        )}
      </div>

      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.time}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {timeOfDayLabels[group.time]}
            </p>
            <div className="space-y-1">
              {group.items.map((s) => {
                const taken = takenIds.has(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggle(s)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-slate-50"
                  >
                    <span
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 text-xs transition ${
                        taken
                          ? 'border-indigo-500 bg-indigo-500 text-white'
                          : 'border-slate-300 bg-white text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                    <span
                      className={`text-sm transition ${
                        taken ? 'text-slate-400 line-through' : 'text-slate-700'
                      }`}
                    >
                      {s.name}
                      {s.dose && <span className="ml-1 text-xs text-slate-400">{s.dose}</span>}
                      {s.with_food && <span className="ml-1 text-xs">🍽</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
