'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Adjustment, ApprovalRequired, OrderDetail } from '@/lib/types';

/**
 * The credit proposal flow. Three steps, and **the user types no number at any
 * point.**
 *
 * 1. Select an issue that is already logged. No free text, no "other".
 * 2. Ask the server to calculate. Render the amount AND its basis.
 * 3. Submit for approval — which returns 202 and applies nothing.
 *
 * There is no amount input here, at any permission level, and there never will
 * be: the backend has no field to receive one (`AUT-2`), so an input would be a
 * control that cannot work. The first person to ask for one is describing an
 * architectural escalation, not a UI change.
 */
export function ProposeCredit({ order, onChanged }: { order: OrderDetail; onChanged: () => void }) {
  const [issueId, setIssueId] = useState<string>('');
  const [adjustment, setAdjustment] = useState<Adjustment | null>(null);
  const [proposal, setProposal] = useState<ApprovalRequired | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openIssues = order.issues.filter((i) => i.status === 'OPEN');

  async function calculate() {
    setBusy(true);
    setError(null);
    setProposal(null);
    try {
      const { data, error: apiError } = await api.POST('/orders/{order_id}/adjustments', {
        params: { path: { order_id: order.id } },
        body: { issue_id: issueId },
      });
      if (apiError) {
        // The envelope's message names the remedy (AUT-13). Never substitute
        // local copy — the server knows why it refused and this does not.
        setError(apiError.error?.message ?? 'Could not calculate a credit.');
      } else if (data) {
        setAdjustment(data);
      }
    } catch {
      setError('Network error. Check that the backend is running.');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!adjustment) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: apiError } = await api.POST('/credits', {
        body: { adjustment_id: adjustment.id },
      });
      if (apiError) {
        setError(apiError.error?.message ?? 'Could not submit this proposal.');
      } else if (data) {
        setProposal(data);
        setAdjustment(null);
        onChanged();
      }
    } catch {
      setError('Network error. Check that the backend is running.');
    } finally {
      setBusy(false);
    }
  }

  if (proposal) {
    return (
      <section className="mt-8 rounded border border-amber-300 bg-amber-50 p-4">
        {/*
          The 202 state. NOT a success banner.

          Nothing has been applied. Saying "credit applied" here would look
          correct in every screenshot and be discovered by a customer who was
          told they had been credited and had not.
        */}
        <h2 className="text-base font-medium text-amber-900">Awaiting approval</h2>
        <p className="mt-1 text-sm text-amber-900">
          Proposed a credit of{' '}
          <span className="font-mono tabular-nums">{proposal.amount}</span>.{' '}
          <strong>Nothing has been applied yet.</strong> A supervisor must approve it.
        </p>
        <p className="mt-2 text-sm">
          <Link href="/approvals" className="text-blue-800 underline underline-offset-2">
            View the approvals queue
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded border border-gray-200 p-4">
      <h2 className="text-base font-medium text-gray-900">Propose a credit</h2>

      {openIssues.length === 0 ? (
        <p className="mt-2 text-sm text-gray-700">
          No open issues on this order, so there is nothing to credit. Log an issue first — a
          credit can only reference an issue that already exists.
        </p>
      ) : (
        <>
          <label htmlFor="issue" className="mt-3 block text-sm font-medium text-gray-700">
            Issue
          </label>
          <select
            id="issue"
            value={issueId}
            onChange={(e) => {
              setIssueId(e.target.value);
              setAdjustment(null);
            }}
            disabled={busy}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          >
            <option value="">Select a logged issue…</option>
            {openIssues.map((issue) => (
              <option key={issue.id} value={issue.id}>
                {issue.issue_type} — {issue.affected_item_ids.length} item
                {issue.affected_item_ids.length === 1 ? '' : 's'}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={calculate}
            disabled={busy || !issueId}
            className="mt-3 rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Calculate credit'}
          </button>
        </>
      )}

      {error && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {adjustment && (
        <div className="mt-4 rounded border border-gray-300 p-3">
          {/*
            The figure carries an accessible name rather than being a bare
            number. A screen reader otherwise announces "20.00" with no idea what
            it is, and the same amount appears again as a line total below.
          */}
          <p id="calculated-credit-label" className="text-sm text-gray-700">
            Calculated credit
          </p>
          <p
            aria-labelledby="calculated-credit-label"
            className="font-mono text-2xl tabular-nums text-gray-900"
          >
            {adjustment.amount}
          </p>

          {/*
            The basis, rendered. This is what turns an approver from a
            rubber-stamp into a reviewer, and it costs one table.
          */}
          <table className="mt-3 w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-300 text-left text-gray-700">
                <th className="py-1 font-medium">SKU</th>
                <th className="py-1 text-right font-medium">Qty</th>
                <th className="py-1 text-right font-medium">Unit</th>
                <th className="py-1 text-right font-medium">Line</th>
              </tr>
            </thead>
            <tbody>
              {(adjustment.basis.lines as BasisLine[] | undefined)?.map((line) => (
                <tr key={line.item_id} className="border-b border-gray-200">
                  <td className="py-1 font-mono text-gray-900">{line.sku}</td>
                  <td className="py-1 text-right font-mono tabular-nums text-gray-900">
                    {line.quantity}
                  </td>
                  <td className="py-1 text-right font-mono tabular-nums text-gray-900">
                    {line.unit_amount}
                  </td>
                  {/* Rendered from the server, never multiplied here. */}
                  <td className="py-1 text-right font-mono tabular-nums text-gray-900">
                    {line.line_total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="mt-3 rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Submitting…' : 'Submit for approval'}
          </button>
        </div>
      )}
    </section>
  );
}

type BasisLine = {
  item_id: string;
  sku: string;
  quantity: number;
  unit_amount: string;
  line_total: string;
};
