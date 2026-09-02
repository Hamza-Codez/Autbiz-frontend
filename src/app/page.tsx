'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
// Re-exported from the generated schema, never redefined (sops.md §7). A local
// `type User = {...}` would keep tsc green through a backend rename and fail at
// runtime instead.
import type { CurrentUser } from '@/lib/types';

/**
 * Navigation is derived from the permission list `GET /auth/me` returns.
 *
 * **This is UX, never security** (`AUT-7`). Hiding a link keeps someone off a
 * screen the backend would refuse anyway; it does not protect anything. Never
 * move an authorization decision here.
 *
 * An unrecognised permission is ignored rather than rendered. The backend may
 * ship a new one before this file knows about it, and dumping raw permission
 * keys on screen is debug output, not navigation.
 */
const NAV: { permission: string; href: string; label: string; description: string }[] = [
  {
    permission: 'orders:read',
    href: '/orders',
    label: 'Orders',
    description: 'Browse orders, their items and any logged issues.',
  },
];

export default function Home() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      const { data, error } = await api.GET('/auth/me');
      if (error || !data) {
        // api wrapper handles 401 redirect, but we also manually catch other issues
        router.push('/login');
      } else {
        setUser(data);
      }
      setLoading(false);
    }
    loadUser();
  }, [router]);

  const handleLogout = async () => {
    await api.POST('/auth/logout');
    router.push('/login');
  };

  const nav = NAV.filter((entry) => user?.permissions.includes(entry.permission));

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-lg">Loading...</div>
      </main>
    );
  }

  if (!user) {
    return null; // redirecting
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Autbiz Shell</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 font-medium">{user.full_name}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Navigation</h2>
          {nav.length === 0 ? (
            <p className="text-gray-600 text-sm">
              No sections are available to this account. An administrator can grant access.
            </p>
          ) : (
            <ul className="space-y-2">
              {nav.map((entry) => (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    className="block rounded border border-gray-200 p-3 hover:border-gray-400"
                  >
                    <span className="text-sm font-medium text-blue-800 underline underline-offset-2">
                      {entry.label}
                    </span>
                    <span className="block text-xs text-gray-600">{entry.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
