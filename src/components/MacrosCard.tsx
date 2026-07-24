// Today's macros as progress toward each daily target (grams eaten / target),
// so a bar means the same thing as the calories/protein bars above.
interface MacroRow {
  label: string;
  grams: number;
  target: number | null;
  color: string;
}

export default function MacrosCard({
  protein,
  carbs,
  fat,
  proteinTarget,
  carbsTarget,
  fatTarget,
}: {
  protein: number;
  carbs: number;
  fat: number;
  proteinTarget: number | null;
  carbsTarget: number | null;
  fatTarget: number | null;
}) {
  const rows: MacroRow[] = [
    { label: 'Protein', grams: protein, target: proteinTarget, color: 'bg-emerald-500' },
    { label: 'Carbs', grams: carbs, target: carbsTarget, color: 'bg-indigo-500' },
    { label: 'Fat', grams: fat, target: fatTarget, color: 'bg-slate-400' },
  ];

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Macros</p>
      <div className="flex flex-col gap-3.5">
        {rows.map((r) => {
          const pct = r.target ? Math.min((r.grams / r.target) * 100, 100) : 0;
          return (
            <div key={r.label} className="flex items-center gap-3">
              <span className="w-14 text-sm text-slate-500">{r.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${r.color}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-20 text-right text-sm text-slate-400">
                <span className="font-semibold text-slate-900">{Math.round(r.grams)}</span>
                {r.target ? ` / ${r.target}` : ''}g
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
