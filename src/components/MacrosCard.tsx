// Today's macro composition — protein / carbs / fat as a share of the day's
// macro calories (4/4/9 kcal per gram), each with the Intake accent colors.
export default function MacrosCard({
  protein,
  carbs,
  fat,
}: {
  protein: number;
  carbs: number;
  fat: number;
}) {
  const cals = { p: protein * 4, c: carbs * 4, f: fat * 9 };
  const total = cals.p + cals.c + cals.f || 1;
  const rows = [
    { label: 'Protein', grams: protein, pct: (cals.p / total) * 100, color: 'bg-emerald-500' },
    { label: 'Carbs', grams: carbs, pct: (cals.c / total) * 100, color: 'bg-indigo-500' },
    { label: 'Fat', grams: fat, pct: (cals.f / total) * 100, color: 'bg-slate-400' },
  ];

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Macros</p>
      <div className="flex flex-col gap-3.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-14 text-sm text-slate-500">{r.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${r.color}`} style={{ width: `${r.pct}%` }} />
            </div>
            <span className="w-10 text-right text-sm font-semibold text-slate-900">
              {Math.round(r.grams)}g
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
