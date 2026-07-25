'use client';

import Logo from './Logo';

export default function CelebrationModal({
  targetKcal,
  onClose,
}: {
  targetKcal: number;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-8"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-pop w-full max-w-[300px] rounded-3xl bg-white p-7 text-center shadow-2xl"
      >
        <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-indigo-50">
          <Logo size={34} />
        </div>
        <h3 className="mt-4 text-xl font-bold text-slate-900">Goal reached!</h3>
        <p className="mt-2 text-sm text-slate-400">
          You hit your {targetKcal.toLocaleString()} kcal target today — nice work staying on track.
        </p>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-indigo-500 py-3 text-[15px] font-semibold text-white transition hover:bg-indigo-600"
        >
          Nice!
        </button>
      </div>
    </div>
  );
}
