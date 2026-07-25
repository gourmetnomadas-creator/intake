'use client';

import { useRef } from 'react';

const PX_PER_KG = 400; // 40px per 0.1 kg

// Vertical draggable/scrollable ruler for picking a weight in 0.1 kg steps.
export default function WeightRuler({
  value,
  onChange,
}: {
  value: number;
  onChange: (kg: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startY: 0, startW: value });
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clamp = (w: number) => Math.min(200, Math.max(30, w));

  const onPointerDown = (e: React.PointerEvent) => {
    try {
      ref.current?.setPointerCapture(e.pointerId);
    } catch {}
    drag.current = { active: true, startY: e.clientY, startW: value };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const dy = e.clientY - drag.current.startY;
    onChange(clamp(drag.current.startW - dy / PX_PER_KG));
  };
  const onPointerUp = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    onChange(Math.round(value * 10) / 10);
  };
  const onWheel = (e: React.WheelEvent) => {
    onChange(clamp(value + (e.deltaY / 100) * 0.1));
    if (wheelTimer.current) clearTimeout(wheelTimer.current);
    wheelTimer.current = setTimeout(() => onChange(Math.round(value * 10) / 10), 120);
  };

  const wTenths = Math.round(value * 10);
  const ticks = [];
  for (let i = -6; i <= 6; i++) {
    const tv = (wTenths + i) / 10;
    const py = (tv - value) * PX_PER_KG;
    const selected = Math.abs(py) < 8;
    ticks.push({ tv, py, selected });
  }

  return (
    <div className="relative mt-2 h-[200px]">
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        className="relative h-[200px] cursor-grab overflow-hidden"
        style={{
          touchAction: 'none',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 15%, #000 85%, transparent)',
          maskImage: 'linear-gradient(to bottom, transparent, #000 15%, #000 85%, transparent)',
        }}
      >
        {ticks.map((t) => (
          <div
            key={t.tv.toFixed(2)}
            className="absolute left-0 right-0 text-center"
            style={{
              top: `calc(50% + ${t.py}px)`,
              transform: 'translateY(-50%)',
              fontFamily: 'var(--font-display), sans-serif',
              fontSize: t.selected ? 30 : 21,
              fontWeight: t.selected ? 700 : 400,
              color: t.selected ? '#17201d' : '#c9ccc7',
            }}
          >
            {t.tv.toFixed(2)}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute left-[20%] right-[20%] h-px bg-slate-200" style={{ top: 'calc(50% - 27px)' }} />
      <div className="pointer-events-none absolute left-[20%] right-[20%] h-px bg-slate-200" style={{ top: 'calc(50% + 27px)' }} />
    </div>
  );
}
