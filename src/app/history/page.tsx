'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getUserSession } from '@/lib/session';
import { Meal } from '@/types';
import { formatTime, getMealTypeLabel } from '@/lib/utils';
import AppShell from '@/components/AppShell';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

export default function HistoryPage() {
  const router = useRouter();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [filteredMeals, setFilteredMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Meal | null>(null);
  const [session, setSession] = useState<any>(null);
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    getUserSession().then((s) => {
      if (!s && !DEV_MODE) {
        router.push('/auth');
        return;
      }
      setSession(s);
      if (s) loadMeals(supabase, s.user.id);
      else setLoading(false);
    });
  }, []);

  const loadMeals = async (supabase: any, userId: string) => {
    const { data } = await supabase
      .from('meals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'saved')
      .order('meal_time', { ascending: false });

    if (data) {
      setMeals(data);
      setFilteredMeals(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    let result = meals;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.description?.toLowerCase().includes(q) ||
          m.meal_type.toLowerCase().includes(q)
      );
    }
    if (dateFilter) {
      result = result.filter((m) => m.date === dateFilter);
    }
    setFilteredMeals(result);
  }, [search, dateFilter, meals]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const supabase = createClient();
    await supabase.from('meals').delete().eq('id', deleteTarget.id);
    setMeals((prev) => prev.filter((m) => m.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleRepeat = async (meal: Meal) => {
    if (!session) return;
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    const { data: newMeal } = await supabase
      .from('meals')
      .insert({
        user_id: session.user.id,
        date: today,
        meal_type: meal.meal_type,
        description: meal.description,
        total_weight_g: meal.total_weight_g,
        weight_context: meal.weight_context,
        total_kcal: meal.total_kcal,
        total_protein_g: meal.total_protein_g,
        total_carbs_g: meal.total_carbs_g,
        total_fat_g: meal.total_fat_g,
        status: 'saved',
      })
      .select()
      .single();

    if (newMeal && meal.id) {
      const { data: items } = await supabase
        .from('meal_items')
        .select('*')
        .eq('meal_id', meal.id);

      if (items) {
        const newItems = items.map((item: any) => ({
          meal_id: newMeal.id,
          food_name: item.food_name,
          grams: item.grams,
          kcal_per_100g: item.kcal_per_100g,
          protein_per_100g: item.protein_per_100g,
          carbs_per_100g: item.carbs_per_100g,
          fat_per_100g: item.fat_per_100g,
          kcal: item.kcal,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fat_g: item.fat_g,
          source: item.source,
          confidence: item.confidence,
        }));
        await supabase.from('meal_items').insert(newItems);
      }
    }

    router.push('/');
  };

  const handleSaveFavorite = async (meal: Meal) => {
    if (!session || favoritedIds.has(meal.id)) return;
    const supabase = createClient();

    const { data: favorite } = await supabase
      .from('favorite_meals')
      .insert({
        user_id: session.user.id,
        name: (meal.description || getMealTypeLabel(meal.meal_type)).slice(0, 60),
        description: meal.description,
        default_total_weight_g: meal.total_weight_g,
      })
      .select()
      .single();

    if (favorite) {
      const { data: items } = await supabase
        .from('meal_items')
        .select('*')
        .eq('meal_id', meal.id);

      if (items && items.length > 0) {
        await supabase.from('favorite_meal_items').insert(
          items.map((item: any) => ({
            favorite_meal_id: favorite.id,
            food_name: item.food_name,
            grams: item.grams,
            kcal_per_100g: item.kcal_per_100g,
            protein_per_100g: item.protein_per_100g,
            carbs_per_100g: item.carbs_per_100g,
            fat_per_100g: item.fat_per_100g,
          }))
        );
      }
      setFavoritedIds((prev) => new Set(prev).add(meal.id));
    }
  };

  if (loading) return <AppShell><LoadingState /></AppShell>;
  if (!session) return null;

  const dayLabel = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });

  // Group the (already newest-first) meals by their date, with per-day totals.
  const dayGroups: { date: string; meals: Meal[]; kcal: number; protein: number }[] = [];
  const dayIndex = new Map<string, number>();
  for (const m of filteredMeals) {
    if (!dayIndex.has(m.date)) {
      dayIndex.set(m.date, dayGroups.length);
      dayGroups.push({ date: m.date, meals: [], kcal: 0, protein: 0 });
    }
    const g = dayGroups[dayIndex.get(m.date)!];
    g.meals.push(m);
    g.kcal += m.total_kcal;
    g.protein += m.total_protein_g;
  }

  // Last 14 calendar days of total calories, for the overview chart.
  const kcalByDate = new Map<string, number>();
  for (const m of meals) kcalByDate.set(m.date, (kcalByDate.get(m.date) || 0) + m.total_kcal);
  const pad = (n: number) => String(n).padStart(2, '0');
  const chartDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return { key, kcal: Math.round(kcalByDate.get(key) || 0), day: d.getDate() };
  });
  const maxKcal = Math.max(1, ...chartDays.map((d) => d.kcal));

  return (
    <AppShell>
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Meal history</h2>

      {meals.length > 0 && (
        <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-medium text-slate-500">Daily calories · last 14 days</p>
          <div className="flex h-24 items-end gap-1">
            {chartDays.map((d) => (
              <div
                key={d.key}
                className="flex-1 rounded-t bg-indigo-400"
                style={{ height: d.kcal > 0 ? `${Math.max(4, (d.kcal / maxKcal) * 100)}%` : '2px' }}
                title={`${d.kcal} kcal`}
              />
            ))}
          </div>
          <div className="mt-1 flex gap-1">
            {chartDays.map((d) => (
              <span key={d.key} className="flex-1 text-center text-[9px] text-slate-400">
                {d.day}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search meals..."
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
        />
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
        />
      </div>

      {filteredMeals.length === 0 ? (
        <EmptyState
          title="No meals found"
          description={search || dateFilter ? 'Try a different search.' : 'Log your first meal to see it here.'}
          action={{ label: 'Add meal', onClick: () => router.push('/meals/new') }}
        />
      ) : (
        <div className="space-y-5">
          {dayGroups.map((group) => (
            <div key={group.date}>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-slate-700">{dayLabel(group.date)}</h3>
                <span className="text-xs text-slate-400">
                  {group.meals.length} {group.meals.length === 1 ? 'meal' : 'meals'} ·{' '}
                  {Math.round(group.kcal)} kcal · P {Math.round(group.protein)}g
                </span>
              </div>
              <div className="space-y-3">
                {group.meals.map((meal) => (
                  <div
                    key={meal.id}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                            {getMealTypeLabel(meal.meal_type)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatTime(meal.meal_time)}
                          </span>
                        </div>
                        {meal.description && (
                          <p className="mt-1 truncate text-sm text-slate-700">{meal.description}</p>
                        )}
                        <div className="mt-1 flex gap-3 text-xs font-medium text-slate-600">
                          <span>{Math.round(meal.total_kcal)} kcal</span>
                          <span className="text-slate-400">P {Math.round(meal.total_protein_g)}g</span>
                          <span className="text-slate-400">C {Math.round(meal.total_carbs_g)}g</span>
                          <span className="text-slate-400">F {Math.round(meal.total_fat_g)}g</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleRepeat(meal)}
                        className="flex-1 rounded-full bg-indigo-500 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-600"
                      >
                        Repeat
                      </button>
                      <button
                        onClick={() => router.push(`/meals/${meal.id}`)}
                        className="flex-1 rounded-lg border border-slate-300 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleSaveFavorite(meal)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          favoritedIds.has(meal.id)
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {favoritedIds.has(meal.id) ? '★' : '☆'}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(meal)}
                        className="rounded-lg px-3 py-1.5 text-xs text-red-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

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
