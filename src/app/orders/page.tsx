'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { OrderSummary } from '@/lib/types';

const SIZE = 20;

function OrdersList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Two things this shape buys, neither of them ceremony:
    //
    // No setState runs before the first `await`. Calling it synchronously in an
    // effect body triggers cascading renders, and React's compiler lint rejects
    // it outright.
    //
    // The `cancelled` guard stops an older response landing after a newer one.
    // Without it, changing pages quickly lets a slow first request overwrite the
    // second's data, and the screen shows results for a page you already left.
    void (async () => {
      try {
        // `page` and `size` — never `limit`. The backend rejects unknown query
        // parameters, so a wrong name is a visible 422 rather than a silently
        // defaulted page, but the point is not to send one.
        const { data, error: apiError } = await api.GET('/orders', {
          params: { query: { page, size: SIZE } },
        });
        if (cancelled) return;
        if (apiError) {
          setError(apiError.error?.message ?? 'Could not load orders.');
        } else if (data) {
          setOrders(data.items);
          // `total` counts rows the server says are visible. Never items.length
          // — that is the size of this page, not the size of the result.
          setTotal(data.total);
          setPages(data.pages);
          setError(null);
        }
      } catch {
        if (!cancelled) setError('Network error. Check that the backend is running.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page]);

  const goToPage = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(next));
    // Query state lives in the URL so a filtered list is linkable and the back
    // button works. Only push when it actually changes — an effect that pushes
    // unconditionally re-triggers itself.
    router.push(`/orders?${params.toString()}`);
  };

  return (
    <main className="mx-auto w-full max-w-5xl p-8">
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">Orders</h1>
      <p className="mb-6 text-sm text-gray-600">
        {loading ? 'Loading…' : `${total} order${total === 1 ? '' : 's'}`}
      </p>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <p className="rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700">
          No orders yet. Run <code className="font-mono">python -m app.demo_seed</code> in the
          backend to load development data.
        </p>
      )}

      {orders.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-700">
              <th className="py-2 font-medium">Order</th>
              <th className="py-2 font-medium">Placed</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 text-right font-medium">Revision</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-gray-200">
                <td className="py-2">
                  <Link
                    href={`/orders/${order.id}`}
                    className="font-mono text-blue-800 underline underline-offset-2"
                  >
                    {order.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="py-2 font-mono tabular-nums text-gray-900">
                  {new Date(order.placed_at).toISOString().slice(0, 10)}
                </td>
                <td className="py-2 text-gray-900">{order.status}</td>
                <td className="py-2 text-right font-mono tabular-nums text-gray-900">
                  {order.revision}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pages > 1 && (
        <nav className="mt-6 flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="rounded border border-gray-300 px-3 py-1 text-gray-800 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-gray-700">
            Page {page} of {pages}
          </span>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= pages}
            className="rounded border border-gray-300 px-3 py-1 text-gray-800 disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      )}
    </main>
  );
}


/**
 * `useSearchParams()` must sit inside a Suspense boundary.
 *
 * Without it `next build` fails while PRERENDERING this route — not at lint,
 * not at type check, not in the test runner, all of which passed. The page
 * reads the query string, so Next.js cannot statically render it and bails to
 * the client; the boundary is what tells it where to resume.
 *
 * This is the failure spec01-frontend warns about: "a framework build can fail
 * on things lint, type check and the test runner all pass." The app simply
 * would not have deployed.
 */
export default function OrdersPage() {
  return (
    <Suspense
      fallback={<main className="mx-auto w-full max-w-5xl p-8 text-gray-700">Loading…</main>}
    >
      <OrdersList />
    </Suspense>
  );
}
