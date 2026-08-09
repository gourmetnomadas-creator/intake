'use client';

import { useEffect } from 'react';
import { MEAL_TYPES, MealType } from '@/types';

interface MealTypeModalProps {
  // What the meal is currently filed as, so the pre-selection is visible.
  current: MealType;
  saving: boolean;
  onSelect: (mealType: MealType) => void;
  onCancel: () => void;
}

export default function MealTypeModal({
  current,
  saving,
  onSelect,
  onCancel,
}: MealTypeModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel, saving]);

  return (
    <div
      onClick={() => !saving && onCancel()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="meal-type-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-pop w-full max-w-[340px] rounded-3xl bg-white p-6 shadow-2xl"
      >
        <h3 id="meal-type-title" className="text-center text-lg font-bold text-slate-900">
          Which meal is this?
        </h3>
        <p className="mt-1 text-center text-sm text-slate-400">Tap one to save.</p>

        <div className="mt-5 space-y-2">
          {MEAL_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              disabled={saving}
              onClick={() => onSelect(type)}
              className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-[15px] font-medium capitalize transition disabled:opacity-50 ${
                type === current
                  ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {type}
              {type === current && (
                <span className="text-xs font-normal opacity-80">selected earlier</span>
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="mt-4 w-full rounded-2xl py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}
