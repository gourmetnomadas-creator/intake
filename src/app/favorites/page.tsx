'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getUserSession } from '@/lib/session';
import { FavoriteMeal } from '@/types';
import AppShell from '@/components/AppShell';
import FavoriteMealCard from '@/components/FavoriteMealCard';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

export default function FavoritesPage() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<FavoriteMeal | null>(null);
  const [session, setSession] = useState<any>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  useEffect(() => {
    const supabase = createClient();
    getUserSession().then((s) => {
      if (!s && !DEV_MODE) {
        router.push('/auth');
        return;
      }
      setSession(s);
      if (s) loadFavorites(supabase, s.user.id);
      else setLoading(false);
    });
  }, []);

  const loadFavorites = async (supabase: any, userId: string) => {
    const { data } = await supabase
      .from('favorite_meals')
      .select('*, items:favorite_meal_items(*)')
      .eq('user_id', userId)
      .order('name');

    if (data) setFavorites(data);
    setLoading(false);
  };

  const handleUse = async (favorite: FavoriteMeal) => {
    if (!session) return;
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();
    const mealType = hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 19 ? 'snack' : 'dinner';

    const items = (favorite.items || []).map((item) => ({
      food_name: item.food_name,
      grams: item.grams,
      kcal_per_100g: item.kcal_per_100g,
      protein_per_100g: item.protein_per_100g,
      carbs_per_100g: item.carbs_per_100g,
      fat_per_100g: item.fat_per_100g,
      kcal: (item.grams * item.kcal_per_100g) / 100,
      protein_g: (item.grams * item.protein_per_100g) / 100,
      carbs_g: (item.grams * item.carbs_per_100g) / 100,
      fat_g: (item.grams * item.fat_per_100g) / 100,
      source: 'favorite',
      confidence: 1,
    }));

    const totals = items.reduce(
      (acc, item) => ({
        total_kcal: acc.total_kcal + item.kcal,
        total_protein_g: acc.total_protein_g + item.protein_g,
        total_carbs_g: acc.total_carbs_g + item.carbs_g,
        total_fat_g: acc.total_fat_g + item.fat_g,
      }),
      { total_kcal: 0, total_protein_g: 0, total_carbs_g: 0, total_fat_g: 0 }
    );

    // Insert the meal already saved, with totals — no fragile draft->saved step.
    const { data: meal, error: mealError } = await supabase
      .from('meals')
      .insert({
        user_id: session.user.id,
        date: today,
        meal_type: mealType,
        description: favorite.description || favorite.name,
        total_weight_g: favorite.default_total_weight_g,
        ...totals,
        status: 'saved',
      })
      .select()
      .single();

    if (mealError || !meal) {
      alert('Could not add this favorite. Please try again.');
      return;
    }

    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from('meal_items')
        .insert(items.map((it) => ({ ...it, meal_id: meal.id })));
      if (itemsError) console.error('Error saving favorite items:', itemsError);
    }

    router.push('/');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const supabase = createClient();
    await supabase.from('favorite_meals').delete().eq('id', deleteTarget.id);
    setFavorites((prev) => prev.filter((f) => f.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleCreate = async () => {
    if (!session || !newName.trim()) return;
    const supabase = createClient();

    await supabase.from('favorite_meals').insert({
      user_id: session.user.id,
      name: newName.trim(),
      description: newDescription.trim() || null,
    });

    setNewName('');
    setNewDescription('');
    setShowNewForm(false);
    loadFavorites(supabase, session.user.id);
  };

  if (loading) return <AppShell><LoadingState /></AppShell>;
  if (!session) return null;

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Favorites</h2>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="rounded-full bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white"
        >
          + New
        </button>
      </div>

      {showNewForm && (
        <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-white p-4">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Meal name"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
          <button
            onClick={handleCreate}
            className="w-full rounded-full bg-indigo-500 py-2 text-sm font-medium text-white"
          >
            Save favorite
          </button>
        </div>
      )}

      {favorites.length === 0 ? (
        <EmptyState
          title="No favorites yet"
          description="Save frequent meals to reuse them quickly."
          action={{ label: 'Create favorite', onClick: () => setShowNewForm(true) }}
        />
      ) : (
        <div className="space-y-3">
          {favorites.map((favorite) => (
            <FavoriteMealCard
              key={favorite.id}
              favorite={favorite}
              onUse={handleUse}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title="Delete favorite?"
        message="This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppShell>
  );
}
