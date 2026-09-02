'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { OrderDetail } from '@/lib/types';

/**
 * Log an issue against an order.
 *
 * **Without this the product is unreachable.** An `OrderIssue` is a record, not
 * an inference (`ARCHITECTURE.md` §5): the agent may reference one and can never
 * create one, so if nothing in the UI creates them, no credit can ever be
 * proposed by anyone. The endpoint shipped in Phase 1 and had no caller until
 * now — issues had to be seeded to exercise the credit flow at all.
 *
 * Requires `orders:read` (§12.3). No new permission, and no tool wraps this.
 */
export function ReportIssue({ order, onChanged }: { order: OrderDetail; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [issueType, setIssueType] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(itemId: string) {
    setSelected((current) =>
      current.includes(itemId) ? current.filter((i) => i !== itemId) : [...current, itemId],
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const { error: apiError } = await api.POST('/orders/{order_id}/issues', {
        params: { path: { order_id: order.id } },
        body: { issue_type: issueType.trim(), affected_item_ids: selected },
      });
      if (apiError) {
        setError(apiError.error?.message ?? 'Could not log this issue.');
        return;
      }
      setOpen(false);
      setIssueType('');
      setSelected([]);
      onChanged();
    } catch {
      setError('Network error. Check that the backend is running.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded border border-gray-400 px-3 py-1.5 text-sm font-medium text-gray-800"
      >
        Log an issue
      </button>
    );
  }

  return (
    <section className="mt-3 rounded border border-gray-300 p-4">
      <h3 className="text-sm font-medium text-gray-900">Log an issue</h3>

      <label htmlFor="issue-type" className="mt-3 block text-sm font-medium text-gray-700">
        What went wrong
      </label>
      {/*
        Free text, deliberately. `issue_type` carries NO eligibility meaning
        (§5) — a credit turns on the 30-day window, an OPEN issue and no prior
        credit, never on the category. Constraining this to a vocabulary would
        make the category the thing worth choosing, which is the back door §5
        warns about.
      */}
      <input
        id="issue-type"
        value={issueType}
        onChange={(e) => setIssueType(e.target.value)}
        disabled={busy}
        maxLength={100}
        placeholder="e.g. Damaged in transit"
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
      />

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-gray-700">Affected items</legend>
        <p className="text-xs text-gray-600">
          Phase 2 calculates the credit from exactly these items.
        </p>
        <ul className="mt-2 space-y-1">
          {order.items.map((item) => (
            <li key={item.id}>
              <label className="flex items-center gap-2 text-sm text-gray-900">
                <input
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  onChange={() => toggle(item.id)}
                  disabled={busy}
                />
                <span className="font-mono">{item.sku}</span>
                <span>{item.description}</span>
                <span className="font-mono tabular-nums text-gray-700">
                  × {item.quantity} @ {item.unit_amount}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {error && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={submit}
          // An issue must name at least one item — the database enforces it too
          // (cardinality > 0), so this only saves a round trip.
          disabled={busy || !issueType.trim() || selected.length === 0}
          className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Logging…' : 'Log issue'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="rounded border border-gray-400 px-4 py-2 text-sm font-medium text-gray-800"
        >
          Cancel
        </button>
      </div>

      <p className="mt-3 text-xs text-gray-600">
        Logging an issue changes the order&rsquo;s revision, so any credit calculated before now
        becomes stale and must be re-run.
      </p>
    </section>
  );
}
