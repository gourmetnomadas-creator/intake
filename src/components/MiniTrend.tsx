// Compact 14-day calorie trend for the Today dashboard: teal area + line with
// a coral dot on the most recent day. Takes one kcal value per day (oldest→newest).
export default function MiniTrend({ values }: { values: number[] }) {
  const w = 320;
  const h = 72;
  const max = Math.max(1, ...values);
  const n = values.length;
  const pts = values.map((v, i) => {
    const x = n === 1 ? w : (i / (n - 1)) * w;
    const y = h - (v / max) * (h - 8) - 4;
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const last = pts[pts.length - 1];

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Last 14 days</p>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <path d={area} fill="#1E6F63" fillOpacity="0.07" />
        <path d={line} fill="none" stroke="#1E6F63" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {last && <circle cx={last[0]} cy={last[1]} r="4.5" fill="#E8654B" />}
      </svg>
    </div>
  );
}
