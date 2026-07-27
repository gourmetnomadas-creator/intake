'use client';

import { useState } from 'react';
import { AIAnalysisItem } from '@/types';
import IngredientRow from './IngredientRow';
import { calculateMealTotals } from '@/lib/calculations';

interface MealReviewTableProps {
  items: AIAnalysisItem[];
  warnings: string[];
  confidence: number;
  onItemsChange: (items: AIAnalysisItem[]) => void;
}

export default function MealReviewTable({
  items,
  warnings,
  confidence,
  onItemsChange,
}: MealReviewTableProps) {
  const [addName, setAddName] = useState('');
  const [adding, setAdding] = useState(false);

  const totals = calculateMealTotals(
    items.map((i) => ({
      grams: i.grams,
      kcal_per_100g: i.kcalPer100g,
      protein_per_100g: i.proteinPer100g,
      carbs_per_100g: i.carbsPer100g,
      fat_per_100g: i.fatPer100g,
    }))
  );

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    onItemsChange(updated);
  };

  const handleDelete = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onItemsChange(updated);
  };

  const handleAddByName = async () => {
    const name = addName.trim();
    if (!name || adding) return;
    setAdding(true);
    let macros = { kcalPer100g: 0, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0 };
    try {
      const res = await fetch('/api/food-nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        macros = {
          kcalPer100g: data.kcalPer100g ?? 0,
          proteinPer100g: data.proteinPer100g ?? 0,
          carbsPer100g: data.carbsPer100g ?? 0,
          fatPer100g: data.fatPer100g ?? 0,
        };
      } else if (data.error) {
        alert(data.error);
      }
    } catch {
      // fall through: add with zeros so the user can fill it in manually
    }
    onItemsChange([
      ...items,
      { foodName: name, grams: 100, ...macros, source: 'manual', confidence: 1 },
    ]);
    setAddName('');
    setAdding(false);
  };

  return (
    <div className="space-y-4">
      {warnings.map((w, i) => (
        <div
          key={i}
          className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs text-indigo-700"
        >
          ⚠️ {w}
        </div>
      ))}

      <div className="rounded-lg bg-slate-50 px-4 py-2 text-center text-xs text-slate-500">
        AI confidence: {Math.round(confidence * 100)}%
      </div>

      <div className="space-y-2">
        {items.map((item, index) => (
          <IngredientRow
            key={index}
            index={index}
            foodName={item.foodName}
            grams={item.grams}
            kcalPer100g={item.kcalPer100g}
            proteinPer100g={item.proteinPer100g}
            carbsPer100g={item.carbsPer100g}
            fatPer100g={item.fatPer100g}
            confidence={item.confidence}
            source={item.source}
            onChange={handleItemChange}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddByName();
            }
          }}
          placeholder="Add ingredient (e.g. maple syrup)"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
        />
        <button
          type="button"
          onClick={handleAddByName}
          disabled={adding || !addName.trim()}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
        >
          {adding ? '…' : 'Add'}
        </button>
      </div>
      <p className="-mt-2 text-[11px] text-slate-400">
        AI fills in the nutrition — review the grams and amounts after.
      </p>

      <div className="rounded-2xl bg-indigo-50 p-4 shadow-sm">
        <h4 className="mb-2 text-sm font-semibold text-slate-700">Totals</h4>
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div>
            <p className="text-lg font-bold text-slate-800">{Math.round(totals.totalKcal)}</p>
            <p className="text-slate-500">kcal</p>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-800">{Math.round(totals.totalProtein)}g</p>
            <p className="text-slate-500">Protein</p>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-800">{Math.round(totals.totalCarbs)}g</p>
            <p className="text-slate-500">Carbs</p>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-800">{Math.round(totals.totalFat)}g</p>
            <p className="text-slate-500">Fat</p>
          </div>
        </div>
      </div>
    </div>
  );
}
