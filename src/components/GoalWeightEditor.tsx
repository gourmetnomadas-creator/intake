'use client';

import { useState } from 'react';

interface GoalWeightEditorProps {
  goalWeight: number | null;
  currentWeight: number | null;
  onSave: (goalWeight: number) => Promise<void>;
}

export default function GoalWeightEditor({
  goalWeight,
  currentWeight,
  onSave,
}: GoalWeightEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const open = () => {
    // Start from the existing goal, or from where they are now.
    setValue(String(goalWeight ?? currentWeight ?? 65));
    setError('');
    setEditing(true);
  };

  const save = async () => {
    const parsed = parseFloat(value.replace(',', '.'));
    if (!(parsed > 20 && parsed < 400)) {
      setError('Enter a weight in kilograms.');
      return;
    }

    setSaving(true);
    try {
      await onSave(Math.round(parsed * 10) / 10);
      setEditing(false);
    } catch {
      setError('Could not save your goal. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={open}
        className="mt-3 flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-slate-50"
      >
        <span>
          <span className="block text-[15px] font-semibold text-slate-900">
            {goalWeight != null ? 'Goal weight' : 'Set a goal weight'}
          </span>
          <span className="mt-0.5 block text-xs text-slate-400">
            {goalWeight != null
              ? `${goalWeight} kg — tap to change`
              : 'Track progress towards a target'}
          </span>
        </span>
        <span className="text-slate-300">›</span>
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <label htmlFor="goal-weight" className="block text-[15px] font-semibold text-slate-900">
        Goal weight
      </label>
      <p className="mt-0.5 text-xs text-slate-400">
        Where you want to get to. You can change it whenever you like.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <input
          id="goal-weight"
          type="number"
          inputMode="decimal"
          step="0.5"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-center text-lg font-semibold outline-none focus:border-indigo-400"
        />
        <span className="text-sm text-slate-500">kg</span>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save goal'}
        </button>
      </div>
    </div>
  );
}
