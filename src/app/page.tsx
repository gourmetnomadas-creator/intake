'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Meal, Profile } from '@/types';
import { formatDate, getMealTypeLabel, mealEmoji } from '@/lib/utils';
import { ageFromBirthdate, calculateDailyCalorieTarget } from '@/lib/calculations';
import { getUserSession } from '@/lib/session';
import AppShell from '@/components/AppShell';
import DailySummaryCard from '@/components/DailySummaryCard';
import SuggestMealCard from '@/components/SuggestMealCard';
import MacrosCard from '@/components/MacrosCard';
import SupplementsCard from '@/components/SupplementsCard';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { useRouter } from 'next/navigation';

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

export default function TodayDashboard() {
  const router = useRouter();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Meal | null>(null);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    getUserSession().then((session) => {
      setSession(session);
      if (!session && !DEV_MODE) {
        router.push('/auth');
        return;
      }
      if (session) {
        const supabase = createClient();
        loadData(supabase, session.user.id);
      } else {
        setLoading(false);
      }
    });
  }, []);

  const loadData = async (supabase: any, userId: string) => {
    const today = new Date().toISOString().split('T')[0];

    const [mealsRes, profileRes] = await Promise.all([
      supabase
        .from('meals')
        .select('*, items:meal_items(*)')
        .eq('user_id', userId)
        .eq('date', today)
        .eq('status', 'saved')
        .order('meal_time', { ascending: true }),
      supabase.from('profiles').select('*').eq('id', userId).single(),
    ]);

    if (mealsRes.data) setMeals(mealsRes.data);
    if (profileRes.data) setProfile(profileRes.data);

    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const supabase = createClient();
    await supabase.from('meals').delete().eq('id', deleteTarget.id);
    setMeals((prev) => prev.filter((m) => m.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  if (loading) return <AppShell><LoadingState /></AppShell>;
  if (!session) return null;

  const targetKcal = profile ? calculateDailyCalorieTarget({
    weight_kg: profile.current_weight_kg,
    height_cm: profile.height_cm,
    age: ageFromBirthdate(profile.birthdate) ?? profile.age,
    sex: profile.sex,
    activity_level: profile.activity_level,
    goal_type: profile.goal_type,
    manual_calorie_target: profile.manual_calorie_target,
  }) : null;

  const proteinTarget = profile?.current_weight_kg
    ? Math.round(profile.current_weight_kg * 1.6)
    : targetKcal
    ? Math.round((targetKcal * 0.3) / 4)
    : null;

  // Balanced macro-gram targets from the calorie goal: fat ~25% of kcal,
  // carbs fill the rest after protein and fat.
  const fatTarget = targetKcal ? Math.round((targetKcal * 0.25) / 9) : null;
  const carbsTarget =
    targetKcal && proteinTarget && fatTarget
      ? Math.round(Math.max(0, targetKcal - proteinTarget * 4 - fatTarget * 9) / 4)
      : null;

  const totals = {
    totalKcal: meals.reduce((sum, m) => sum + m.total_kcal, 0),
    totalProtein: meals.reduce((sum, m) => sum + m.total_protein_g, 0),
    totalCarbs: meals.reduce((sum, m) => sum + m.total_carbs_g, 0),
    totalFat: meals.reduce((sum, m) => sum + m.total_fat_g, 0),
  };

  const remaining = targetKcal !== null ? Math.round(targetKcal - totals.totalKcal) : null;
  const statusLine =
    remaining === null
      ? 'Set your goal in Profile to track your progress.'
      : remaining > 0
      ? `You're ${remaining} kcal from your goal.`
      : remaining === 0
      ? "You've hit your goal exactly — nice."
      : `You're ${Math.abs(remaining)} kcal over your goal.`;

  return (
    <AppShell>
      <header className="mb-4">
        <h2 className="text-2xl font-bold text-slate-900">Today</h2>
        <p className="mt-0.5 text-sm text-slate-400">{formatDate(new Date().toISOString())}</p>
        <p className="mt-2 text-sm text-slate-700">{statusLine}</p>
      </header>

      <div className="space-y-4">
        <DailySummaryCard
          {...totals}
          targetKcal={targetKcal}
          proteinTarget={proteinTarget}
        />

        <SuggestMealCard
          userId={session.user.id}
          remainingKcal={remaining}
          remainingProtein={proteinTarget !== null ? Math.round(proteinTarget - totals.totalProtein) : null}
          dietType={profile?.diet_type ?? null}
          restrictions={profile?.dietary_restrictions ?? null}
        />

        {/* Quick add — shortcut into the full logging flow */}
        <button
          onClick={() => router.push('/meals/new')}
          className="flex w-full items-center gap-3 rounded-2xl bg-white p-2.5 pl-5 text-left shadow-sm"
        >
          <span className="flex-1 text-[15px] text-slate-400">What did you eat?</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-500">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 8h2l1.5-2h9L18 8h2a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="3.4" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500 text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>

        {/* Today's meals — compact list */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Today&apos;s meals</p>
          {meals.length === 0 ? (
            <EmptyState
              title="No meals logged today"
              description="Tap Add to log your first meal."
              action={{ label: 'Add meal', onClick: () => router.push('/meals/new') }}
            />
          ) : (
            <div className="flex flex-col">
              {meals.map((meal, i) => (
                <div
                  key={meal.id}
                  className={`flex items-center gap-3 py-2.5 ${
                    i < meals.length - 1 ? 'border-b border-slate-100' : ''
                  }`}
                >
                  <button
                    onClick={() => router.push(`/meals/${meal.id}`)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-lg">
                      {mealEmoji(meal)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900">
                        {getMealTypeLabel(meal.meal_type)}
                      </span>
                      {meal.description && (
                        <span className="block truncate text-xs text-slate-400">{meal.description}</span>
                      )}
                    </span>
                  </button>
                  <span className="text-sm font-semibold text-slate-900">{Math.round(meal.total_kcal)} kcal</span>
                  <button
                    onClick={() => setDeleteTarget(meal)}
                    className="rounded px-1 text-xs text-red-300 hover:text-red-500"
                    aria-label="Delete meal"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <MacrosCard
          protein={totals.totalProtein}
          carbs={totals.totalCarbs}
          fat={totals.totalFat}
          proteinTarget={proteinTarget}
          carbsTarget={carbsTarget}
          fatTarget={fatTarget}
        />

        <SupplementsCard userId={session.user.id} />
      </div>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title="Delete meal?"
        message="This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppShell>
  );
}
