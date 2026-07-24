// Intake logomark: a face built from the tracking gesture — the mouth is the
// "intake" bowl stroke, the eyes are the two states of a logged entry
// (X = pending, check = confirmed). Geometry from the brand handoff (100x100).
export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path d="M27 52 Q38.5 70 50 71 Q61.5 70 73 52" stroke="#1E6F63" strokeWidth="8" strokeLinecap="round" />
      <path d="M31 27 L41 39 M43 26 L33 40" stroke="#17201D" strokeWidth="7" strokeLinecap="round" />
      <path d="M57 35 L63 43 L76 25" stroke="#E8654B" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// White-on-teal variant for the app-icon tile / dark grounds.
export function LogoOnTeal({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path d="M27 52 Q38.5 70 50 71 Q61.5 70 73 52" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" />
      <path d="M31 27 L41 39 M43 26 L33 40" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" />
      <path d="M57 35 L63 43 L76 25" stroke="#E8654B" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
