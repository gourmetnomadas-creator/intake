'use client';

import { Meal } from '@/types';
import { getMealTypeLabel, formatTime, mealEmoji } from '@/lib/utils';

interface MealCardProps {
  meal: Meal;
  onEdit: (meal: Meal) => void;
  onDelete: (meal: Meal) => void;
}

export default function MealCard({ meal, onEdit, onDelete }: MealCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300">
      <div className="flex gap-3">
        {meal.photo_url ? (
          <img
            src={meal.photo_url}
            alt={meal.description || 'Meal'}
            className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-3xl">
            {mealEmoji(meal)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-block rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                {getMealTypeLabel(meal.meal_type)}
              </span>
              <span className="ml-2 text-[10px] text-slate-400">{formatTime(meal.meal_time)}</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => onEdit(meal)}
                className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:text-slate-600"
              >
                ✎
              </button>
              <button
                onClick={() => onDelete(meal)}
                className="rounded px-1.5 py-0.5 text-xs text-red-300 hover:text-red-500"
              >
                ✕
              </button>
            </div>
          </div>
          {meal.description && (
            <p className="mt-1 truncate text-sm text-slate-700">{meal.description}</p>
          )}
          {meal.total_weight_g && (
            <p className="text-xs text-slate-400">{Math.round(meal.total_weight_g)} g</p>
          )}
          <div className="mt-1 flex gap-3 text-xs font-medium text-slate-600">
            <span>{Math.round(meal.total_kcal)} kcal</span>
            <span className="text-slate-400">P {Math.round(meal.total_protein_g)}g</span>
            <span className="text-slate-400">C {Math.round(meal.total_carbs_g)}g</span>
            <span className="text-slate-400">F {Math.round(meal.total_fat_g)}g</span>
          </div>
        </div>
      </div>
    </div>
  );
}
