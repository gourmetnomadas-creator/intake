'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { suggestionBudget, suggestionContext } from '@/lib/calculations';

interface Suggestion {
  title: string;
  description: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  why: string;
  repeat: boolean;
}

interface Props {
  userId: string;
  remainingKcal: number | null;
  remainingProtein: number | null;
  remainingCarbs: number | null;
  remainingFat: number | null;
  loggedMealTypes: string[];
  lastMealAt: string | null;
  consumedToday: string[];
  dietType: string | null;
  restrictions: string | null;
}

export default function SuggestMealCard({
  userId,
  remainingKcal,
  remainingProtein,
  remainingCarbs,
  remainingFat,
  loggedMealTypes,
  lastMealAt,
  consumedToday,
  dietType,
  restrictions,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [open, setOpen] = useState(true);

  // Where the day stands, from the meals already logged and the clock — the
  // clock alone would offer dinner at 19:00 to someone who just ate dinner.
  const context = suggestionContext({ loggedMealTypes, lastMealAt });
  const budget = suggestionBudget(remainingKcal, context);

  const generate = async () => {
    setLoading(true);
    setSuggestions(null);
    const supabase = createClient();

    // Learn from what the user actually eats: recent meal descriptions.
    const { data: recent } = await supabase
      .from('meals')
      .select('description')
      .eq('user_id', userId)
      .eq('status', 'saved')
      .order('date', { ascending: false })
      .limit(30);
    const recentFoods = (recent || [])
      .map((m: { description: string | null }) => m.description)
      .filter(Boolean)
      .join('; ')
      .slice(0, 1200);

    try {
      const res = await fetch('/api/suggest-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mealType: context.mealType,
          isClosing: context.isClosing,
          minutesSinceLastMeal: context.minutesSinceLastMeal,
          maxKcal: budget.maxKcal,
          targetKcal: budget.targetKcal,
          count: budget.count,
          remainingProtein,
          remainingCarbs,
          remainingFat,
          consumedToday,
          dietType,
          restrictions,
          recentFoods,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuggestions(data.suggestions || []);
        setOpen(true);
      } else {
        alert(data.error || 'Could not get suggestions. Please try again.');
      }
    } catch {
      alert('Could not get suggestions. Please try again.');
    }
    setLoading(false);
  };

  const logIt = (s: Suggestion) => {
    router.push(`/meals/new?description=${encodeURIComponent(s.description)}`);
  };

  // Chasing the last few calories with a whole extra meal is worse advice than
  // saying nothing, so say nothing — and offer a light option only on request.
  const closingNote =
    budget.count === 0
      ? "You've covered today's calories — nothing left to close."
      : context.isClosing
      ? `Only ${budget.maxKcal} kcal left and your main meals are done — you don't need another meal. Tap Suggest if you want something light.`
      : `Only ${budget.maxKcal} kcal left — you don't need a full meal. Tap Suggest if you want something light.`;

  return (
    <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => suggestions && setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <span className="truncate text-sm font-semibold text-slate-700">
            What should I eat next?
          </span>
          {suggestions && (
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              className={`flex-shrink-0 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`}
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        {budget.count > 0 && (
          <button
            onClick={generate}
            disabled={loading}
            className="flex-shrink-0 rounded-full bg-indigo-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
          >
            {loading ? 'Thinking…' : suggestions ? 'Refresh' : 'Suggest'}
          </button>
        )}
      </div>

      {budget.nothingNeeded && (
        <p className="mt-2 text-xs text-slate-500">
          {closingNote}
        </p>
      )}

      {!suggestions && !loading && budget.count > 0 && !budget.nothingNeeded && (
        <p className="mt-2 text-xs text-slate-400">
          AI suggests what to eat next from where your day stands, the room left in your budget,
          and your dietary preferences.
        </p>
      )}

      {suggestions && open && (
        <div className="mt-3 space-y-2">
          {suggestions.map((s, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                {s.repeat && (
                  <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                    Repeat
                  </span>
                )}
                <p className="text-sm font-medium text-slate-800">{s.title}</p>
              </div>
              <p className="mt-1 text-xs text-slate-600">{s.description}</p>
              <div className="mt-1.5 flex gap-3 text-xs font-medium text-slate-600">
                <span>{Math.round(s.kcal)} kcal</span>
                <span className="text-emerald-600">P {Math.round(s.protein_g)}g</span>
                <span className="text-slate-400">C {Math.round(s.carbs_g)}g</span>
                <span className="text-slate-400">F {Math.round(s.fat_g)}g</span>
              </div>
              {s.why && <p className="mt-1 text-[11px] text-slate-400">💡 {s.why}</p>}
              <button
                onClick={() => logIt(s)}
                className="mt-2 w-full rounded-full bg-indigo-50 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
              >
                Log this
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
