'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { OrderCredits } from '@/components/OrderCredits';
import { ProposeCredit } from '@/components/ProposeCredit';
import { ReportIssue } from '@/components/ReportIssue';
import type { OrderDetail } from '@/lib/types';

/**
 * Money is rendered from the server's value and never computed here.
 *
 * No subtotal, no line total, no sum of items — `sops.md` and this repo's
 * CLAUDE.md both forbid it. Once a number the user sees is produced by the
 * client, "the figure on screen" and "the figure the backend will act on" become
 * two values that can disagree, which is the whole thing the architecture exists
 * to prevent. When a total is needed, the API will provide one.
 */
function money(value: string): string {
  return value;
}

export default function OrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reload, setReload] = useState(0);

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
        const { data, error: apiError, response } = await api.GET('/orders/{order_id}', {
          params: { path: { order_id: orderId } },
        });
        if (cancelled) return;
        if (response.status === 404) {
          setNotFound(true);
        } else if (apiError) {
          setError(apiError.error?.message ?? 'Could not load this order.');
        } else if (data) {
          setOrder(data);
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
  }, [orderId, reload]);

  if (loading) {
    return <main className="mx-auto w-full max-w-4xl p-8 text-gray-700">Loading…</main>;
  }

  if (notFound) {
    // Deliberately says nothing about why. The API returns an identical body for
    // an order that does not exist and one the caller may not see (AUT-7);
    // wording them differently here would undo that at the last hop.
    return (
      <main className="mx-auto w-full max-w-4xl p-8">
        <p className="rounded border border-gray-200 bg-gray-50 p-6 text-gray-800">
          Not found.{' '}
          <Link href="/orders" className="text-blue-800 underline underline-offset-2">
            Back to orders
          </Link>
        </p>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="mx-auto w-full max-w-4xl p-8">
        <p className="rounded border border-red-200 bg-red-50 p-4 text-red-800">
          {error ?? 'Could not load this order.'}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-8">
      <Link href="/orders" className="text-sm text-blue-800 underline underline-offset-2">
        ← Orders
      </Link>

      <h1 className="mt-3 font-mono text-xl font-semibold text-gray-900">{order.id}</h1>

      <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-gray-600">Status</dt>
          <dd className="text-gray-900">{order.status}</dd>
        </div>
        <div>
          <dt className="text-gray-600">Placed</dt>
          <dd className="font-mono tabular-nums text-gray-900">
            {new Date(order.placed_at).toISOString().slice(0, 10)}
          </dd>
        </div>
        <div>
          <dt className="text-gray-600">Revision</dt>
          <dd className="font-mono tabular-nums text-gray-900">{order.revision}</dd>
        </div>
        <div>
          <dt className="text-gray-600">Customer</dt>
          <dd>
            <Link
              href={`/customers/${order.customer_id}`}
              className="font-mono text-blue-800 underline underline-offset-2"
            >
              {order.customer_id.slice(0, 8)}
            </Link>
          </dd>
        </div>
      </dl>

      <h2 className="mt-8 mb-2 text-lg font-medium text-gray-900">Items</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-300 text-left text-gray-700">
            <th className="py-2 font-medium">SKU</th>
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Unit</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-gray-200">
              <td className="py-2 font-mono text-gray-900">{item.sku}</td>
              <td className="py-2 text-gray-900">{item.description}</td>
              <td className="py-2 text-right font-mono tabular-nums text-gray-900">
                {item.quantity}
              </td>
              <td className="py-2 text-right font-mono tabular-nums text-gray-900">
                {money(item.unit_amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* No total row. See money() above — the client computes no figures. */}

      <h2 className="mt-8 mb-2 text-lg font-medium text-gray-900">Issues</h2>
      {order.issues.length === 0 ? (
        <p className="text-sm text-gray-700">No issues logged against this order.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {order.issues.map((issue) => (
            <li key={issue.id} className="rounded border border-gray-200 p-3">
              <span className="font-medium text-gray-900">{issue.issue_type}</span>
              <span className="ml-2 text-gray-700">({issue.status})</span>
              <div className="mt-1 font-mono text-xs text-gray-600">
                {issue.affected_item_ids.length} affected item
                {issue.affected_item_ids.length === 1 ? '' : 's'} ·{' '}
                {new Date(issue.reported_at).toISOString().slice(0, 10)}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ReportIssue order={order} onChanged={() => setReload((n) => n + 1)} />

      <ProposeCredit order={order} onChanged={() => setReload((n) => n + 1)} />

      <OrderCredits orderId={order.id} reloadKey={reload} />
    </main>
  );
}
