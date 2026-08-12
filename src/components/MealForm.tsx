'use client';

import { useState, useMemo } from 'react';
import MealPhotoInput from './MealPhotoInput';
import VoiceDescriptionInput from './VoiceDescriptionInput';
import { MealType, WeightContext, Meal } from '@/types';
import { suggestNextMealType } from '@/lib/calculations';

interface MealFormProps {
  onSubmit: (data: {
    description: string;
    mealType: MealType;
    date: string;
    totalWeightGrams: number | null;
    weightContext: WeightContext | null;
    imageBase64: string | null;
  }) => void;
  loading: boolean;
  initialDescription?: string;
  todayMeals?: Meal[];
}

const today = () => new Date().toISOString().split('T')[0];

export default function MealForm({ onSubmit, loading, initialDescription = '', todayMeals = [] }: MealFormProps) {
  const [description, setDescription] = useState(initialDescription);
  // Which meal this is gets asked once, in the confirmation modal after the
  // analysis. This is only the seed for the option preselected there, so it
  // rides along silently rather than as a second set of buttons here.
  const mealType = useMemo(
    () => suggestNextMealType(todayMeals.map((m) => m.meal_type)),
    [todayMeals]
  );
  const [date, setDate] = useState(today());
  const [totalWeightGrams, setTotalWeightGrams] = useState('');
  const [weightContext, setWeightContext] = useState<WeightContext>('whole_plate');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const weight = parseFloat(totalWeightGrams);
    // Either one is enough on its own — the AI reads the photo too.
    if (!description.trim() && !imageBase64) {
      setError('Add a photo or a description of the meal.');
      return;
    }

    onSubmit({
      description: description.trim(),
      mealType,
      date,
      totalWeightGrams: weight > 0 ? weight : null,
      weightContext: weight > 0 ? weightContext : null,
      imageBase64,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Date{date !== today() ? ' (logging a past day)' : ''}
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={today()}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Photo</label>
        <MealPhotoInput
          photoPreview={imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : null}
          onPhotoCapture={setImageBase64}
          onClear={() => setImageBase64(null)}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder='e.g. "oatmeal with banana" or "200g oatmeal and one banana"'
          rows={2}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
        />
        <VoiceDescriptionInput
          disabled={loading}
          // Added to whatever is already typed, so dictating twice builds the
          // description up instead of replacing it.
          onTranscribed={(text) =>
            setDescription((current) => (current.trim() ? `${current.trim()} ${text}` : text))
          }
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Total weight in grams <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          type="number"
          value={totalWeightGrams}
          onChange={(e) => setTotalWeightGrams(e.target.value)}
          placeholder="e.g. 200 — leave blank to estimate by portion"
          min="1"
          step="1"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
        />
        {!(parseFloat(totalWeightGrams) > 0) && (
          <p className="mt-1 text-xs text-slate-400">
            No scale? Describe the portion (e.g. &quot;a glass of wine&quot;) and the AI estimates it.
          </p>
        )}
      </div>

      {parseFloat(totalWeightGrams) > 0 && (
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          What does the weight refer to?
        </label>
        <div className="space-y-2">
          {(
            [
              { value: 'whole_plate', label: 'Whole plate' },
              { value: 'one_ingredient', label: 'One ingredient only' },
              { value: 'separate_ingredients', label: 'Ingredients weighed separately' },
            ] as { value: WeightContext; label: string }[]
          ).map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center rounded-lg border px-3 py-2 text-sm transition ${
                weightContext === option.value
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="weightContext"
                value={option.value}
                checked={weightContext === option.value}
                onChange={() => setWeightContext(option.value)}
                className="mr-2 accent-indigo-500"
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-indigo-500 py-3 text-base font-semibold text-white transition hover:bg-indigo-600 active:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Analyzing...' : 'Analyze meal'}
      </button>
    </form>
  );
}
