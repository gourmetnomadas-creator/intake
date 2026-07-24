'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Meal, Profile } from '@/types';
import { getMealTypeLabel, formatDate } from '@/lib/utils';
import { ageFromBirthdate, calculateDailyCalorieTarget } from '@/lib/calculations';
import { getUserSession } from '@/lib/session';
import AppShell from '@/components/AppShell';
import DailySummaryCard from '@/components/DailySummaryCard';
import SupplementsCard from '@/components/SupplementsCard';
import MealCard from '@/components/MealCard';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { useRouter } from 'next/navigation';

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

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

  // Protein goal: 1.6 g/kg body weight (same target Pulso recommends).
  // Fall back to 30% of the calorie target / 4 kcal-per-gram when no weight.
  const proteinTarget = profile?.current_weight_kg
    ? Math.round(profile.current_weight_kg * 1.6)
    : targetKcal
    ? Math.round((targetKcal * 0.3) / 4)
    : null;

  const totals = {
    totalKcal: meals.reduce((sum, m) => sum + m.total_kcal, 0),
    totalProtein: meals.reduce((sum, m) => sum + m.total_protein_g, 0),
    totalCarbs: meals.reduce((sum, m) => sum + m.total_carbs_g, 0),
    totalFat: meals.reduce((sum, m) => sum + m.total_fat_g, 0),
  };

  const groupedMeals = mealOrder.map((type) => ({
    type,
    label: getMealTypeLabel(type),
    meals: meals.filter((m) => m.meal_type === type),
  }));

  return (
    <AppShell>
      <h2 className="mb-4 text-sm font-medium text-slate-500">{formatDate(new Date().toISOString())}</h2>

      <DailySummaryCard
        {...totals}
        targetKcal={targetKcal}
        proteinTarget={proteinTarget}
      />

      <div className="mt-6 space-y-4">
        {groupedMeals.map((group) =>
          group.meals.length > 0 ? (
            <div key={group.type}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.meals.map((meal) => (
                  <MealCard
                    key={meal.id}
                    meal={meal}
                    onEdit={(m) => router.push(`/meals/${m.id}`)}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            </div>
          ) : null
        )}

        {meals.length === 0 && (
          <EmptyState
            title="No meals logged today"
            description="Tap Add to log your first meal."
            action={{ label: 'Add meal', onClick: () => router.push('/meals/new') }}
          />
        )}
      </div>

      <SupplementsCard userId={session.user.id} />

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
