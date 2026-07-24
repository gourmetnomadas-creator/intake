interface MacroSummaryProps {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  targetKcal?: number;
  proteinTarget?: number;
  showTarget?: boolean;
}

function ProgressRow({
  label,
  value,
  target,
  unit,
  color,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  color: string;
}) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  const remaining = Math.round(target - value);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className="text-sm text-slate-400">
          <span className="text-lg font-bold text-slate-800">{Math.round(value)}</span>
          {' / '}
          {Math.round(target)} {unit}
        </span>
      </div>
      <div className="my-1.5 h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-500">
        {remaining > 0
          ? `${remaining} ${unit} remaining`
          : `${Math.abs(remaining)} ${unit} over target`}
      </p>
    </div>
  );
}

export default function MacroSummary({
  kcal,
  protein,
  carbs,
  fat,
  targetKcal,
  proteinTarget,
  showTarget = false,
}: MacroSummaryProps) {
  const hasTargets = showTarget && !!targetKcal;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      {hasTargets ? (
        <div className="space-y-4">
          <ProgressRow
            label="Calories"
            value={kcal}
            target={targetKcal!}
            unit="kcal"
            color="bg-indigo-500"
          />
          {proteinTarget ? (
            <ProgressRow
              label="Protein"
              value={protein}
              target={proteinTarget}
              unit="g"
              color="bg-emerald-500"
            />
          ) : null}
          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-center text-xs">
            <div>
              <p className="font-semibold text-slate-700">{Math.round(carbs)}g</p>
              <p className="text-slate-400">Carbs</p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">{Math.round(fat)}g</p>
              <p className="text-slate-400">Fat</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-800">{Math.round(kcal)}</span>
            <span className="text-sm text-slate-500">kcal</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="font-semibold text-slate-700">{Math.round(protein)}g</p>
              <p className="text-slate-400">Protein</p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">{Math.round(carbs)}g</p>
              <p className="text-slate-400">Carbs</p>
            </div>
            <div>
              <p className="font-semibold text-slate-700">{Math.round(fat)}g</p>
              <p className="text-slate-400">Fat</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
