'use client';

import { useEffect, useRef, useState } from 'react';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const DURATION = 1600;

// Intake intro: the face holds neutral (flat mouth, both eyes as X), the right
// eye winks once and swaps X -> check at its closing point, and that reopening
// is what curves the mouth into a smile. Coordinates/colors/timing from the
// brand's splash scene.
export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setProgress(1);
      const t = setTimeout(() => setExiting(true), 300);
      return () => clearTimeout(t);
    }
    const start = performance.now();
    const tick = (now: number) => {
      const p = clamp01((now - start) / DURATION);
      setProgress(p);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setTimeout(() => setExiting(true), 150);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const entrance = smoothstep(0, 0.12, progress);
  const bump = Math.sin(smoothstep(0.85, 0.95, progress) * Math.PI) * 0.045;
  const scale = lerp(0.85, 1, entrance) + bump;
  const opacity = lerp(0, 1, entrance);

  const winkT = smoothstep(0.35, 0.62, progress);
  const eyeScaleY = 1 - Math.abs(Math.sin(Math.PI * winkT)) * 0.97;
  const rightIsCheck = winkT >= 0.5;

  const mouthMorph = smoothstep(0.5, 0.68, progress);
  const c1 = lerp(52, 70, mouthMorph);
  const mid = lerp(52, 71, mouthMorph);
  const c2 = lerp(52, 70, mouthMorph);
  const mouthPath = `M27 52 Q38.5 ${c1.toFixed(2)} 50 ${mid.toFixed(2)} Q61.5 ${c2.toFixed(2)} 73 52`;

  const eyeGroup = {
    transformOrigin: '66px 34px',
    transformBox: 'view-box' as const,
    WebkitTransformBox: 'view-box' as any,
  };

  return (
    <div
      onTransitionEnd={() => exiting && onDone()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: '#F6F5F1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: exiting ? 0 : 1,
        transition: 'opacity 0.35s ease',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width={220}
        height={220}
        style={{ opacity, transform: `scale(${scale})`, transformOrigin: '50px 50px' }}
      >
        <path d={mouthPath} stroke="#1E6F63" strokeWidth={8} fill="none" strokeLinecap="round" />
        <path d="M31 27 L41 39 M43 26 L33 40" stroke="#17201D" strokeWidth={7} strokeLinecap="round" fill="none" />
        <g style={{ ...eyeGroup, transform: `scaleY(${eyeScaleY})`, opacity: rightIsCheck ? 0 : 1 }}>
          <path d="M59 28 L69 40 M71 28 L61 41" stroke="#17201D" strokeWidth={7} strokeLinecap="round" fill="none" />
        </g>
        <g style={{ ...eyeGroup, transform: `scaleY(${eyeScaleY})`, opacity: rightIsCheck ? 1 : 0 }}>
          <path d="M57 35 L63 43 L76 25" stroke="#E8654B" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      </svg>
    </div>
  );
}
