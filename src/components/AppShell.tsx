'use client';

import BottomNav from './BottomNav';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-lg pb-28">
      <header className="flex items-center gap-2 px-4 py-3">
        <Logo size={26} />
        <h1 className="text-lg font-semibold text-slate-900">Intake</h1>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>
      <main className="px-4 py-4">{children}</main>
      <BottomNav />
    </div>
  );
}
