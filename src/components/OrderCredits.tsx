'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Credit } from '@/lib/types';

/**
 * Credits already issued against this order.
 *
 * **This closes the loop.** Before it existed, approving a credit emptied the
 * queue and the credit became invisible: nothing in the product showed it
 * existed except a balance on a different screen. An operator had no way to see
 * whether their proposal had been approved or rejected.
 *
 * It also makes `CREDIT_ALREADY_ISSUED` explicable — the refusal now points at
 * something the user can see rather than at a record they have to take on faith.
 */
export function OrderCredits({ orderId, reloadKey }: { orderId: string; reloadKey: number }) {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error, response } = await api.GET('/credits', {
        params: { query: { order_id: orderId, page: 1, size: 20 } },
      });
      if (cancelled) return;
      if (response.status === 403) {
        // `credits:read` is a separate permission. A principal without it sees
        // no section rather than an error — this is not a fault worth shouting
        // about.
        setForbidden(true);
      } else if (!error && data) {
        setCredits(data.items);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, reloadKey]);

  if (forbidden || credits.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-2 text-lg font-medium text-gray-900">Credits issued</h2>
      <ul className="space-y-2 text-sm">
        {credits.map((credit) => (
          <li
            key={credit.id}
            className="flex items-baseline justify-between rounded border border-green-300 bg-green-50 p-3"
          >
            {/* Rendered from the server. Never summed or recomputed here. */}
            <span className="font-mono text-lg tabular-nums text-green-900">{credit.amount}</span>
            <span className="font-mono text-xs text-green-900">
              {new Date(credit.created_at).toISOString().slice(0, 10)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-gray-600">
        One credit per issue is a database constraint, so an issue that appears here cannot be
        credited twice.
      </p>
    </section>
  );
}
