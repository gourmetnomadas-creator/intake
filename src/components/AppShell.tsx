'use client';

import BottomNav from './BottomNav';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-lg pb-28">
      <header className="border-b border-slate-100 px-4 py-3">
        <h1 className="text-lg font-bold text-slate-800">Plate Log</h1>
      </header>
      <main className="px-4 py-4">{children}</main>
      <BottomNav />
    </div>
  );
}
