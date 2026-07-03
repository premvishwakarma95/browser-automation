'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Dashboard', icon: '▚' },
  { href: '/students', label: 'Students', icon: '☰' },
  { href: '/universities', label: 'Universities', icon: '⌂' },
  { href: '/applications', label: 'Applications', icon: '✦' },
  { href: '/playground', label: 'Playground', icon: '⚡' },
];

export default function Sidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-6 py-5">
        <span className="text-xl">🎓</span>
        <span className="text-lg font-bold tracking-tight text-slate-900">Alzato</span>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {NAV.map((n) => {
          const active = isActive(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className={`text-xs ${active ? 'text-indigo-500' : 'text-slate-400'}`}>{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-6 py-4 text-xs text-slate-400">
        Automated Admissions
      </div>
    </aside>
  );
}
