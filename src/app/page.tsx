'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
// Re-exported from the generated schema, never redefined (sops.md §7). A local
// `type User = {...}` would keep tsc green through a backend rename and fail at
// runtime instead.
import type { CurrentUser } from '@/lib/types';

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
          {user.permissions.length === 0 ? (
            <p className="text-gray-500 text-sm">No permissions granted.</p>
          ) : (
            <ul className="space-y-2">
              {user.permissions.map((perm) => (
                <li key={perm} className="text-sm text-gray-700 p-2 bg-gray-50 rounded border border-gray-100">
                  {perm}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
