'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getUserSession } from '@/lib/session';
import { BodyWeightLog } from '@/types';
import AppShell from '@/components/AppShell';
import WeightRuler from '@/components/WeightRuler';
import LoadingState from '@/components/LoadingState';
import { buildTrendPath } from '@/lib/calculations';

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true' && process.env.NODE_ENV !== 'production';

function shortDate(iso: string) {
  const [, m, d] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

export default function WeightPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<BodyWeightLog[]>([]);
  const [goalWeight, setGoalWeight] = useState<number | null>(null);
  const [profileWeight, setProfileWeight] = useState<number | null>(null);
  const [weight, setWeight] = useState(60);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    getUserSession().then((s) => {
      if (!s && !DEV_MODE) {
        router.push('/auth');
        return;
      }
      if (s) {
        setUserId(s.user.id);
        load(supabase, s.user.id);
      } else {
        setLoading(false);
      }
    });
  }, []);

  const load = async (supabase: any, uid: string) => {
    const [logsRes, profileRes] = await Promise.all([
      supabase.from('body_weight_logs').select('*').eq('user_id', uid).order('date', { ascending: true }),
      supabase.from('profiles').select('goal_weight_kg, current_weight_kg').eq('id', uid).single(),
    ]);
    const data: BodyWeightLog[] = logsRes.data ?? [];
    setLogs(data);
    setGoalWeight(profileRes.data?.goal_weight_kg ?? null);
    setProfileWeight(profileRes.data?.current_weight_kg ?? null);
    const latest = data.length ? data[data.length - 1].weight_kg : profileRes.data?.current_weight_kg;
    setWeight(latest ? Math.round(latest * 10) / 10 : 60);
    setLoading(false);
  };

  const handleLog = async () => {
    if (!userId) return;
    setSaving(true);
    const supabase = createClient();
    const rounded = Math.round(weight * 10) / 10;
    const today = new Date().toISOString().slice(0, 10);
    // one entry per day: replace today's if it exists
    await supabase.from('body_weight_logs').delete().eq('user_id', userId).eq('date', today);
    await supabase.from('body_weight_logs').insert({ user_id: userId, date: today, weight_kg: rounded });
    // keep the profile's current weight in sync
    await supabase.from('profiles').update({ current_weight_kg: rounded }).eq('id', userId);
    setSaving(false);
    load(supabase, userId);
  };

  if (loading) return <AppShell><LoadingState /></AppShell>;

  const rounded = Math.round(weight * 10) / 10;
  const entries = logs.map((l) => ({ date: l.date, kg: l.weight_kg }));
  const lastWeight = entries.length ? entries[entries.length - 1].kg : profileWeight;

  // Delta of the picked weight vs the last logged weight
  const diff = lastWeight != null ? Math.round((rounded - lastWeight) * 10) / 10 : null;
  const deltaLabel =
    diff == null
      ? ''
      : diff > 0
      ? `▲ ${diff.toFixed(1)} kg since last log`
      : diff < 0
      ? `▼ ${Math.abs(diff).toFixed(1)} kg since last log`
      : 'No change since last log';

  // Goal ring
  const start = entries.length ? entries[0].kg : profileWeight;
  let goalRing: null | { offset: number; circ: number; remainingLabel: string; rangeLabel: string } = null;
  if (goalWeight != null && lastWeight != null && start != null) {
    const R = 54;
    const circ = 2 * Math.PI * R;
    const goalDiff = goalWeight - start;
    const progress = goalDiff !== 0 ? Math.min(1, Math.max(0, (lastWeight - start) / goalDiff)) : 1;
    const remaining = Math.round((goalWeight - lastWeight) * 100) / 100;
    goalRing = {
      circ,
      offset: circ * (1 - progress),
      remainingLabel: Math.abs(remaining) < 0.05 ? '🎉' : remaining > 0 ? `+${remaining.toFixed(1)}` : remaining.toFixed(1),
      rangeLabel: `${lastWeight}kg to ${goalWeight}kg`,
    };
  }

  // History chart
  const n = entries.length;
  const path = buildTrendPath(entries.map((e) => e.kg), {
    width: 328,
    height: 140,
    include: goalWeight,
  });
  const chart = path && {
    ...path,
    goalY: goalWeight != null ? path.yAt(goalWeight) : -1,
    last: path.points[n - 1],
    labels: [...new Set(n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0])].map((i) =>
      shortDate(entries[i].date)
    ),
  };

  const recent = [...entries].reverse().slice(0, 3);

  return (
    <AppShell>
      <h2 className="mb-2 text-lg font-semibold text-slate-800">Log body weight</h2>

      {goalRing && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-center text-xs text-slate-400">Goal</p>
          <div className="relative mx-auto mt-2 h-[132px] w-[132px]">
            <svg width="132" height="132" viewBox="0 0 132 132" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="66" cy="66" r="54" fill="none" stroke="#f0efe9" strokeWidth="9" />
              <circle
                cx="66" cy="66" r="54" fill="none" stroke="#1E6F63" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={goalRing.circ} strokeDashoffset={goalRing.offset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[26px] font-bold text-slate-900" style={{ fontFamily: 'var(--font-display), sans-serif' }}>
                {goalRing.remainingLabel}
              </span>
              <span className="text-xs text-slate-400">kg</span>
            </div>
          </div>
          <p className="mt-3 text-center text-sm text-slate-900">{goalRing.rangeLabel}</p>
        </div>
      )}

      {deltaLabel && <p className="mt-5 text-center text-[13px] font-semibold text-slate-400">{deltaLabel}</p>}

      <p className="mt-5 text-center text-[15px] font-semibold text-slate-900">Kg</p>
      <WeightRuler value={weight} onChange={setWeight} />

      <button
        onClick={handleLog}
        disabled={saving}
        className="mt-7 w-full rounded-2xl bg-indigo-500 py-3.5 text-base font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Log weight'}
      </button>

      {chart && (
        <div className="mt-8 rounded-2xl bg-slate-50 p-[18px]">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">History</span>
            {goalWeight != null && <span className="text-[11px] text-slate-300">Goal {goalWeight} kg</span>}
          </div>
          <svg viewBox="0 0 328 140" width="100%" height="130" preserveAspectRatio="none" className="mt-2.5 block overflow-visible">
            {chart.goalY >= 0 && (
              <line x1="0" y1={chart.goalY} x2="328" y2={chart.goalY} stroke="#b8bcb8" strokeWidth="1" strokeDasharray="4,4" />
            )}
            <path d={chart.area} fill="#1E6F63" fillOpacity="0.12" />
            <path d={chart.line} fill="none" stroke="#1E6F63" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={chart.last[0]} cy={chart.last[1]} r="4.5" fill="#E8654B" />
          </svg>
          <div className="mt-1.5 flex justify-between">
            {chart.labels.map((l, i) => (
              <span key={i} className="text-[11px] text-slate-300">{l}</span>
            ))}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-5">
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Recent</p>
          <div className="flex flex-col gap-2">
            {recent.map((e) => (
              <div key={e.date} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3.5">
                <span className="text-[13px] text-slate-400">{shortDate(e.date)}</span>
                <span className="text-sm font-semibold text-slate-900">{e.kg} kg</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <p className="mt-6 text-center text-sm text-slate-400">
          Set the ruler to your weight and tap Log weight to start your history.
        </p>
      )}
    </AppShell>
  );
}
