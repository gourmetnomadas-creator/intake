'use client';

declare global {
  interface Window {
    __setTheme?: (choice: 'light' | 'dark' | 'system') => void;
  }
}

/**
 * Light/dark switch. Applying the theme lives in the inline script in
 * layout.tsx (it has to run before first paint); this button only records the
 * choice, and swaps its own icon through the `dark:` variant so it needs no
 * state of its own and cannot disagree with the page it is sitting on.
 */
export default function ThemeToggle() {
  const toggle = () => {
    const isDark = document.documentElement.classList.contains('dark');
    window.__setTheme?.(isDark ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
    >
      {/* Moon in light mode, sun in dark: the icon shows where the tap goes. */}
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="dark:hidden">
        <path
          d="M20.5 14.6A8.6 8.6 0 019.4 3.5a8.6 8.6 0 1011.1 11.1z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="hidden dark:block">
        <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.6 5.4l-1.6 1.6M7 17l-1.6 1.6M18.6 18.6L17 17M7 7L5.4 5.4"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
