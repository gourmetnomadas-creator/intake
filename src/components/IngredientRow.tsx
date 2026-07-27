'use client';

interface IngredientRowProps {
  index: number;
  foodName: string;
  grams: number;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  confidence?: number | null;
  source?: string | null;
  onChange: (index: number, field: string, value: string | number) => void;
  onDelete: (index: number) => void;
}

// The row shows each ingredient's ACTUAL macros for its grams (not per-100g),
// so changing grams rescales everything. Internally the item still stores
// per-100g values, so editing an absolute macro back-computes its density.
export default function IngredientRow({
  index,
  foodName,
  grams,
  kcalPer100g,
  proteinPer100g,
  carbsPer100g,
  fatPer100g,
  confidence,
  source,
  onChange,
  onDelete,
}: IngredientRowProps) {
  const factor = grams / 100;
  const round = (n: number, d = 1) => {
    const m = 10 ** d;
    return Math.round(n * m) / m;
  };

  // Absolute macro values shown in the inputs.
  const kcal = round(kcalPer100g * factor, 0);
  const protein = round(proteinPer100g * factor);
  const carbs = round(carbsPer100g * factor);
  const fat = round(fatPer100g * factor);

  const setGrams = (value: string) => onChange(index, 'grams', parseFloat(value) || 0);

  // Editing an absolute macro sets the per-100g density from it and the grams.
  const setAbsolute = (field100: string, value: string) => {
    const abs = parseFloat(value) || 0;
    const per100 = grams > 0 ? (abs * 100) / grams : 0;
    onChange(index, field100, per100);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-start justify-between">
        <input
          type="text"
          value={foodName}
          onChange={(e) => onChange(index, 'foodName', e.target.value)}
          className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm font-medium text-slate-800 outline-none focus:border-indigo-400"
        />
        <button
          type="button"
          onClick={() => onDelete(index)}
          className="ml-2 text-sm text-red-400 hover:text-red-600"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-5 gap-2 text-xs">
        <div>
          <label className="block text-slate-400">Grams</label>
          <input
            type="number"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            className="w-full rounded border border-slate-200 px-1.5 py-1 text-center outline-none focus:border-indigo-400"
            min="0"
            step="1"
          />
        </div>
        <div>
          <label className="block text-slate-400">kcal</label>
          <input
            type="number"
            value={kcal}
            onChange={(e) => setAbsolute('kcalPer100g', e.target.value)}
            className="w-full rounded border border-slate-200 px-1.5 py-1 text-center outline-none focus:border-indigo-400"
            min="0"
            step="1"
          />
        </div>
        <div>
          <label className="block text-slate-400">Protein</label>
          <input
            type="number"
            value={protein}
            onChange={(e) => setAbsolute('proteinPer100g', e.target.value)}
            className="w-full rounded border border-slate-200 px-1.5 py-1 text-center outline-none focus:border-indigo-400"
            min="0"
            step="0.1"
          />
        </div>
        <div>
          <label className="block text-slate-400">Carbs</label>
          <input
            type="number"
            value={carbs}
            onChange={(e) => setAbsolute('carbsPer100g', e.target.value)}
            className="w-full rounded border border-slate-200 px-1.5 py-1 text-center outline-none focus:border-indigo-400"
            min="0"
            step="0.1"
          />
        </div>
        <div>
          <label className="block text-slate-400">Fat</label>
          <input
            type="number"
            value={fat}
            onChange={(e) => setAbsolute('fatPer100g', e.target.value)}
            className="w-full rounded border border-slate-200 px-1.5 py-1 text-center outline-none focus:border-indigo-400"
            min="0"
            step="0.1"
          />
        </div>
      </div>
      {(confidence || source) && (
        <div className="mt-1 flex gap-3 text-[10px] text-slate-400">
          {confidence ? <span>Confidence: {Math.round(confidence * 100)}%</span> : null}
          {source && <span>Source: {source}</span>}
        </div>
      )}
    </div>
  );
}
