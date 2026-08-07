'use client';

import { useState } from 'react';

export default function WeightRuler({
  value,
  onChange,
}: {
  value: number;
  onChange: (kg: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputVal, setInputVal] = useState(value.toFixed(1));
  const clamp = (w: number) => Math.min(200, Math.max(30, w));

  const handleDecrement = () => onChange(clamp(Math.round((value - 0.1) * 10) / 10));
  const handleIncrement = () => onChange(clamp(Math.round((value + 0.1) * 10) / 10));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputVal(e.target.value);
  };

  const handleInputBlur = () => {
    const parsed = parseFloat(inputVal);
    if (!isNaN(parsed)) {
      onChange(clamp(Math.round(parsed * 10) / 10));
    } else {
      setInputVal(value.toFixed(1));
    }
    setIsEditing(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleInputBlur();
    if (e.key === 'Escape') {
      setInputVal(value.toFixed(1));
      setIsEditing(false);
    }
  };

  return (
    <div className="mt-5 flex items-center justify-center gap-4">
      <button
        onClick={handleDecrement}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-600 transition hover:bg-slate-200 active:bg-slate-300"
        aria-label="Decrease weight"
      >
        −
      </button>

      {isEditing ? (
        <input
          type="number"
          value={inputVal}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          autoFocus
          step="0.1"
          min="30"
          max="200"
          className="w-24 rounded-lg border-2 border-indigo-400 bg-white px-2 py-2 text-center text-2xl font-bold text-slate-900 outline-none"
        />
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="w-24 cursor-pointer rounded-lg py-2 text-center text-3xl font-bold text-slate-900 transition hover:bg-slate-50"
        >
          {value.toFixed(1)}
        </button>
      )}

      <button
        onClick={handleIncrement}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-600 transition hover:bg-slate-200 active:bg-slate-300"
        aria-label="Increase weight"
      >
        +
      </button>
    </div>
  );
}
