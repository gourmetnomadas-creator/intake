'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getUserSession } from '@/lib/session';
import { BodyWeightLog } from '@/types';
import AppShell from '@/components/AppShell';
import WeightLogForm from '@/components/WeightLogForm';
import LoadingState from '@/components/LoadingState';

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

export default function WeightPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<BodyWeightLog[]>([]);
  const [goalWeight, setGoalWeight] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    getUserSession().then((s) => {
      if (!s && !DEV_MODE) {
        router.push('/auth');
        return;
      }
      if (s) {
        loadLogs(supabase, s.user.id);
        supabase
          .from('profiles')
          .select('goal_weight_kg')
          .eq('id', s.user.id)
          .single()
          .then(({ data }: { data: { goal_weight_kg: number | null } | null }) => {
            if (data) setGoalWeight(data.goal_weight_kg);
          });
      } else {
        setLoading(false);
      }
    });
  }, []);

  const loadLogs = async (supabase: any, userId: string) => {
    const { data } = await supabase
      .from('body_weight_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (data) setLogs(data);
    setLoading(false);
  };

  const handleSave = async (data: { date: string; weight_kg: number; notes: string }) => {
    setSaving(true);
    const supabase = createClient();
    const s = await getUserSession();
    if (!s) return;

    const { error } = await supabase.from('body_weight_logs').insert({
      user_id: s.user.id,
      ...data,
    });

    if (!error) {
      loadLogs(supabase, s.user.id);
    }
    setSaving(false);
  };

  const latestWeight = logs.length > 0 ? logs[0].weight_kg : null;

  if (loading) return <AppShell><LoadingState /></AppShell>;

  return (
    <AppShell>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Body weight</h2>
        {latestWeight && (
          <p className="text-3xl font-bold text-slate-800">{latestWeight} <span className="text-base font-normal text-slate-400">kg</span></p>
        )}
        {latestWeight && goalWeight && goalWeight !== latestWeight && (
          <p className="mt-1 text-sm text-slate-500">
            Goal {goalWeight} kg ·{' '}
            <span className="font-medium text-indigo-600">
              {Math.abs(goalWeight - latestWeight).toFixed(1)} kg to {goalWeight > latestWeight ? 'gain' : 'lose'}
            </span>
          </p>
        )}
      </div>

      <WeightLogForm onSave={handleSave} saving={saving} />

      <div className="mt-6 space-y-2">
        {logs.length === 0 ? (
          <p className="text-center text-sm text-slate-400">No weight logs yet.</p>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <span className="text-sm text-slate-500">{log.date}</span>
              <span className="font-medium text-slate-700">{log.weight_kg} kg</span>
              {log.notes && <span className="text-xs text-slate-400">{log.notes}</span>}
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
