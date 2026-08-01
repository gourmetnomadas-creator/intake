'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getUserSession } from '@/lib/session';
import { Profile, Meal } from '@/types';
import AppShell from '@/components/AppShell';
import ProfileCard from '@/components/ProfileCard';
import LoadingState from '@/components/LoadingState';
import { buildMarkdownReport } from '@/lib/export-report';

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [weightTrend, setWeightTrend] = useState<number | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    const supabase = createClient();
    const s = await getUserSession();
    if (!s) {
      setExporting(false);
      return;
    }
    const userId = s.user.id;

    const [prof, meals, weights, supps, logs] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase
        .from('meals')
        .select('*, items:meal_items(*)')
        .eq('user_id', userId)
        .eq('status', 'saved')
        .order('date', { ascending: false }),
      supabase.from('body_weight_logs').select('*').eq('user_id', userId),
      supabase.from('supplements').select('*').eq('user_id', userId).order('created_at'),
      supabase.from('supplement_logs').select('supplement_id, date').eq('user_id', userId),
    ]);

    const md = buildMarkdownReport({
      profile: prof.data ?? null,
      meals: meals.data ?? [],
      weights: weights.data ?? [],
      supplements: supps.data ?? [],
      supplementLogs: logs.data ?? [],
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `intake-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  useEffect(() => {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];
    getUserSession().then((s) => {
      if (!s && !DEV_MODE) {
        router.push('/auth');
        return;
      }
      if (s) {
        Promise.all([
          supabase.from('profiles').select('*').eq('id', s.user.id).single(),
          supabase
            .from('body_weight_logs')
            .select('weight_kg, date')
            .eq('user_id', s.user.id)
            .order('date', { ascending: false })
            .limit(2),
          supabase
            .from('meals')
            .select('*, items:meal_items(*)')
            .eq('user_id', s.user.id)
            .eq('date', today)
            .eq('status', 'saved'),
        ]).then(([profRes, logsRes, mealsRes]) => {
          if (profRes.data) setProfile(profRes.data);
          const logs = logsRes.data ?? [];
          const latest = logs[0]?.weight_kg ?? profRes.data?.current_weight_kg ?? null;
          setCurrentWeight(latest);
          if (logs.length >= 2) {
            setWeightTrend(Math.round((logs[0].weight_kg - logs[1].weight_kg) * 10) / 10);
          }
          setMeals(mealsRes.data ?? []);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
  }, []);

  if (loading) return <AppShell><LoadingState /></AppShell>;

  return (
    <AppShell>
      <ProfileCard
        profile={profile}
        currentWeight={currentWeight}
        weightTrend={weightTrend}
        meals={meals}
        onExport={handleExport}
        onSignOut={async () => {
          const supabase = createClient();
          await supabase.auth.signOut();
          router.push('/auth');
        }}
        onEditProfile={() => router.push('/weight')}
        onEditPreferences={() => router.push('/')}
      />
    </AppShell>
  );
}
