'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { ApprovalRequest, CurrentUser } from '@/lib/types';

type BasisLine = { item_id: string; sku: string; quantity: number; line_total: string };

/**
 * The approvals queue.
 *
 * One queue for everything awaiting a decision. When Phase 3 adds cancellation
 * approvals they appear here too — a second queue would let a supervisor clear
 * one and believe they were done.
 */
export default function ApprovalsPage() {
  const [rows, setRows] = useState<ApprovalRequest[]>([]);
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // No setState before the first await, and a cancellation guard so a slow
    // response cannot land after a newer one.
    void (async () => {
      try {
        const [queue, who] = await Promise.all([api.GET('/approvals'), api.GET('/auth/me')]);
        if (cancelled) return;
        if (queue.error) {
          setError(queue.error.error?.message ?? 'Could not load the approvals queue.');
        } else {
          setRows(queue.data ?? []);
          setError(null);
        }
        if (who.data) setMe(who.data);
      } catch {
        if (!cancelled) setError('Network error. Check that the backend is running.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const decide = useCallback(async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id);
    setError(null);
    try {
      const path = action === 'approve' ? '/approvals/{request_id}/approve' : '/approvals/{request_id}/reject';
      const { error: apiError } = await api.POST(path, {
        params: { path: { request_id: id } },
      });
      if (apiError) {
        // STALE_CALCULATION and PROPOSAL_EXPIRED are DIFFERENT situations and
        // §8 gives them different messages. Rendering the envelope verbatim is
        // what keeps that distinction — each one already names its remedy.
        setError(apiError.error?.message ?? 'Could not complete that decision.');
        // Deliberately NO reload here.
        //
        // An earlier version refreshed unconditionally, and the refetch's
        // success path cleared the error it had just set — so a refused approval
        // flashed its reason and then showed nothing. The supervisor would see
        // the row unchanged with no explanation, which reads as a dead button.
        return;
      }
      setReload((n) => n + 1);
    } catch {
      setError('Network error. Check that the backend is running.');
    } finally {
      setBusyId(null);
    }
  }, []);

  if (loading) {
    return <main className="mx-auto w-full max-w-4xl p-8 text-gray-700">Loading…</main>;
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-8">
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">Approvals</h1>
      <p className="mb-6 text-sm text-gray-600">
        {rows.length} awaiting a decision
      </p>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {rows.length === 0 && !error && (
        <p className="rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700">
          Nothing is waiting for approval.
        </p>
      )}

      <ul className="space-y-4">
        {rows.map((row) => {
          const mine = me?.id === row.initiated_by;
          const lines = (row.basis.lines as BasisLine[] | undefined) ?? [];
          return (
            <li key={row.id} className="rounded border border-gray-300 p-4">
              <div className="flex items-baseline justify-between">
                <span
                  aria-label={`Proposed credit of ${row.amount}`}
                  className="font-mono text-xl tabular-nums text-gray-900"
                >
                  {row.amount}
                </span>
                {row.is_expired && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                    Expired
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm">
                <Link
                  href={`/orders/${row.order_id}`}
                  className="font-mono text-blue-800 underline underline-offset-2"
                >
                  {row.order_id.slice(0, 8)}
                </Link>
              </p>

              {/* The basis. An approver shown only a figure is rubber-stamping. */}
              {lines.length > 0 && (
                <ul className="mt-2 space-y-0.5 font-mono text-xs text-gray-700">
                  {lines.map((line) => (
                    <li key={line.item_id}>
                      {line.sku} × {line.quantity} = {line.line_total}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3">
                {row.is_expired ? (
                  <p className="text-sm text-gray-700">
                    This proposal expired. The figure must be re-calculated on the order.
                  </p>
                ) : mine ? (
                  // UX only. AUT-4 refuses this at the database and the service
                  // returns 409 SELF_APPROVAL regardless — but a button that
                  // always fails is a bad button, so say why it is absent.
                  <p className="text-sm text-gray-700">
                    You proposed this. It needs a different approver.
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => decide(row.id, 'approve')}
                      disabled={busyId === row.id}
                      className="rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {busyId === row.id ? 'Working…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(row.id, 'reject')}
                      disabled={busyId === row.id}
                      className="rounded border border-gray-400 px-3 py-1.5 text-sm font-medium text-gray-800 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
