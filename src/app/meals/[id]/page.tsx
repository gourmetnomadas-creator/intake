'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getUserSession } from '@/lib/session';
import AppShell from '@/components/AppShell';
import MealReviewTable from '@/components/MealReviewTable';
import LoadingState from '@/components/LoadingState';
import { Meal, AIAnalysisItem } from '@/types';

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true' && process.env.NODE_ENV !== 'production';

export default function EditMealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [mealType, setMealType] = useState('lunch');
  const [timeHHMM, setTimeHHMM] = useState('12:00');
  const [items, setItems] = useState<AIAnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();
    getUserSession().then((s) => {
      if (!s && !DEV_MODE) {
        router.push('/auth');
        return;
      }
      setSession(s);
      if (s) loadMeal(supabase, s.user.id);
      else setLoading(false);
    });
  }, [id]);

  const loadMeal = async (supabase: any, userId: string) => {
    const { data: meal } = await supabase
      .from('meals')
      .select('*, items:meal_items(*)')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (meal) {
      setMeal(meal);
      setMealType(meal.meal_type);
      const t = new Date(meal.meal_time);
      setTimeHHMM(
        `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
      );
      setItems(
        (meal.items || []).map((item: any) => ({
          foodName: item.food_name,
          grams: item.grams,
          kcalPer100g: item.kcal_per_100g,
          proteinPer100g: item.protein_per_100g,
          carbsPer100g: item.carbs_per_100g,
          fatPer100g: item.fat_per_100g,
          source: item.source || 'manual',
          confidence: item.confidence || 1,
        }))
      );
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!meal || !session) return;
    setSaving(true);

    const supabase = createClient();

    const totals = items.reduce(
      (acc, item) => ({
        totalKcal: acc.totalKcal + (item.grams * item.kcalPer100g) / 100,
        totalProtein: acc.totalProtein + (item.grams * item.proteinPer100g) / 100,
        totalCarbs: acc.totalCarbs + (item.grams * item.carbsPer100g) / 100,
        totalFat: acc.totalFat + (item.grams * item.fatPer100g) / 100,
      }),
      { totalKcal: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 }
    );

    // Rebuild meal_time from the meal's own date + the edited time-of-day.
    const newMealTime = new Date(`${meal.date}T${timeHHMM}:00`);

    await supabase
      .from('meals')
      .update({
        meal_type: mealType,
        meal_time: isNaN(newMealTime.getTime()) ? meal.meal_time : newMealTime.toISOString(),
        total_kcal: totals.totalKcal,
        total_protein_g: totals.totalProtein,
        total_carbs_g: totals.totalCarbs,
        total_fat_g: totals.totalFat,
      })
      .eq('id', id);

    await supabase.from('meal_items').delete().eq('meal_id', id);

    const mealItems = items.map((item) => ({
      meal_id: id,
      food_name: item.foodName,
      grams: item.grams,
      kcal_per_100g: item.kcalPer100g,
      protein_per_100g: item.proteinPer100g,
      carbs_per_100g: item.carbsPer100g,
      fat_per_100g: item.fatPer100g,
      kcal: (item.grams * item.kcalPer100g) / 100,
      protein_g: (item.grams * item.proteinPer100g) / 100,
      carbs_g: (item.grams * item.carbsPer100g) / 100,
      fat_g: (item.grams * item.fatPer100g) / 100,
      source: item.source,
      confidence: item.confidence,
    }));

    await supabase.from('meal_items').insert(mealItems);

    setSaving(false);
    router.push('/');
  };

  if (loading) return <AppShell><LoadingState /></AppShell>;
  if (!meal) return <AppShell><p className="text-slate-500">Meal not found.</p></AppShell>;

  return (
    <AppShell>
      <h2 className="mb-1 text-lg font-semibold text-slate-800">Edit meal</h2>
      {meal.description && (
        <p className="mb-4 text-sm text-slate-500">{meal.description}</p>
      )}

      <div className="mb-4 grid grid-cols-[1fr_auto] gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Meal type</label>
          <div className="grid grid-cols-4 gap-2">
            {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMealType(type)}
                className={`rounded-lg py-2 text-xs font-medium capitalize transition ${
                  mealType === type
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Time</label>
          <input
            type="time"
            value={timeHHMM}
            onChange={(e) => setTimeHHMM(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      <MealReviewTable
        items={items}
        warnings={[
          'This is an estimate. Please review the grams before saving.',
        ]}
        confidence={meal.ai_confidence ?? 0.7}
        onItemsChange={setItems}
      />

      <div className="mt-5 flex gap-3">
        <button
          onClick={() => router.push('/')}
          className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-full bg-indigo-500 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </AppShell>
  );
}
