'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getUserSession } from '@/lib/session';
import AppShell from '@/components/AppShell';
import AddTabs from '@/components/AddTabs';
import MealForm from '@/components/MealForm';
import MealReviewTable from '@/components/MealReviewTable';
import { AIAnalysisResult, AIAnalysisItem, MealType, WeightContext } from '@/types';

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true' && process.env.NODE_ENV !== 'production';

export default function AddMealPage() {
  return (
    <Suspense fallback={null}>
      <AddMealInner />
    </Suspense>
  );
}

function AddMealInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillDescription = searchParams.get('description') || '';
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [editableItems, setEditableItems] = useState<AIAnalysisItem[]>([]);
  const [todayMeals, setTodayMeals] = useState<any[]>([]);
  const [formData, setFormData] = useState<{
    description: string;
    mealType: MealType;
    date: string;
    totalWeightGrams: number | null;
    weightContext: WeightContext | null;
    imageBase64: string | null;
  } | null>(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    getUserSession().then((s) => {
      if (!s && !DEV_MODE) {
        router.push('/auth');
        return;
      }
      setSession(s);
    });
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchTodayMeals = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('date', today)
        .order('meal_time', { ascending: true });

      setTodayMeals(data || []);
    };

    fetchTodayMeals();
  }, [session?.user?.id]);

  const handleAnalyze = async (data: {
    description: string;
    mealType: MealType;
    date: string;
    totalWeightGrams: number | null;
    weightContext: WeightContext | null;
    imageBase64: string | null;
  }) => {
    setLoading(true);
    setFormData(data);

    try {
      // The AI only uses the text (description + weight); the photo is a
      // local preview. Don't POST the multi-MB base64 image — it blows past
      // the request-size limit and Safari throws a pattern-match error.
      const { imageBase64, ...analyzePayload } = data;
      const res = await fetch('/api/analyze-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analyzePayload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Analysis failed');
      }

      const result: AIAnalysisResult = await res.json();
      setAnalysis(result);
      setEditableItems(result.items);
    } catch (err: any) {
      alert(err.message || 'Could not analyze meal. Please try again or add ingredients manually.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData || !session) return;
    setSaving(true);

    const supabase = createClient();

    const totals = editableItems.reduce(
      (acc, item) => ({
        totalKcal: acc.totalKcal + (item.grams * item.kcalPer100g) / 100,
        totalProtein: acc.totalProtein + (item.grams * item.proteinPer100g) / 100,
        totalCarbs: acc.totalCarbs + (item.grams * item.carbsPer100g) / 100,
        totalFat: acc.totalFat + (item.grams * item.fatPer100g) / 100,
      }),
      { totalKcal: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 }
    );

    const { data: meal, error: mealError } = await supabase
      .from('meals')
      .insert({
        user_id: session.user.id,
        date: formData.date,
        meal_type: formData.mealType,
        description: formData.description,
        total_weight_g: formData.totalWeightGrams,
        weight_context: formData.weightContext,
        total_kcal: totals.totalKcal,
        total_protein_g: totals.totalProtein,
        total_carbs_g: totals.totalCarbs,
        total_fat_g: totals.totalFat,
        ai_confidence: analysis?.confidence ?? null,
        status: 'saved',
      })
      .select()
      .single();

    if (mealError) {
      alert('Could not save meal. Please try again.');
      setSaving(false);
      return;
    }

    const mealItems = editableItems.map((item) => ({
      meal_id: meal.id,
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

    const { error: itemsError } = await supabase
      .from('meal_items')
      .insert(mealItems);

    if (itemsError) {
      console.error('Error saving items:', itemsError);
    }

    setSaving(false);
    router.push('/');
  };

  if (!session) return null;

  return (
    <AppShell>
      {!analysis && <AddTabs active="meal" />}
      <h2 className="mb-4 text-lg font-semibold text-slate-800">
        {analysis ? 'Review meal' : 'Add meal'}
      </h2>

      {!analysis ? (
        <MealForm onSubmit={handleAnalyze} loading={loading} initialDescription={prefillDescription} todayMeals={todayMeals} />
      ) : (
        <div className="space-y-5">
          <MealReviewTable
            items={editableItems}
            warnings={analysis.warnings}
            confidence={analysis.confidence}
            onItemsChange={setEditableItems}
          />
          <div className="flex gap-3">
            <button
              onClick={() => {
                setAnalysis(null);
                setEditableItems([]);
              }}
              className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-full bg-indigo-500 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save meal'}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
