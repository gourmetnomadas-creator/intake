'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      {children}
    </svg>
  );
}

const navItems = [
  {
    href: '/',
    label: 'Today',
    icon: (
      <Icon>
        <path d="M18 20V10M12 20V4M6 20v-6" />
      </Icon>
    ),
  },
  {
    href: '/meals/new',
    label: 'Add',
    icon: (
      <Icon>
        <path d="M12 5v14M5 12h14" />
      </Icon>
    ),
  },
  {
    href: '/history',
    label: 'History',
    icon: (
      <Icon>
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01" />
      </Icon>
    ),
  },
  {
    href: '/favorites',
    label: 'Favs',
    icon: (
      <Icon>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </Icon>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (
      <Icon>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </Icon>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg justify-around px-2 py-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition ${
                isActive
                  ? 'text-indigo-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <span
                className={`flex h-8 w-10 items-center justify-center rounded-full transition ${
                  isActive ? 'bg-indigo-50' : ''
                }`}
              >
                {item.icon}
              </span>
              <span className={isActive ? 'font-semibold' : 'font-medium'}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
