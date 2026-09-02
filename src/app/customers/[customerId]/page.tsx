'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Account, Customer } from '@/lib/types';

export default function CustomerPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = use(params);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
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
        const customerResult = await api.GET('/customers/{customer_id}', {
          params: { path: { customer_id: customerId } },
        });
        if (cancelled) return;

        if (customerResult.response.status === 404) {
          setNotFound(true);
          return;
        }
        if (customerResult.error) {
          setError(customerResult.error.error?.message ?? 'Could not load this customer.');
          return;
        }
        setCustomer(customerResult.data ?? null);

        // A separate permission (accounts:read) guards this, so a principal with
        // orders:read alone sees the customer and no balance. A 403 here is not
        // an error worth shouting about — the section simply does not appear.
        const accountResult = await api.GET('/customers/{customer_id}/account', {
          params: { path: { customer_id: customerId } },
        });
        if (cancelled) return;
        if (!accountResult.error && accountResult.data) {
          setAccount(accountResult.data);
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
  }, [customerId]);

  if (loading) {
    return <main className="mx-auto w-full max-w-3xl p-8 text-gray-700">Loading…</main>;
  }

  if (notFound) {
    // Same wording as an absent record, deliberately (AUT-7).
    return (
      <main className="mx-auto w-full max-w-3xl p-8">
        <p className="rounded border border-gray-200 bg-gray-50 p-6 text-gray-800">
          Not found.{' '}
          <Link href="/orders" className="text-blue-800 underline underline-offset-2">
            Back to orders
          </Link>
        </p>
      </main>
    );
  }

  if (error || !customer) {
    return (
      <main className="mx-auto w-full max-w-3xl p-8">
        <p className="rounded border border-red-200 bg-red-50 p-4 text-red-800">
          {error ?? 'Could not load this customer.'}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <Link href="/orders" className="text-sm text-blue-800 underline underline-offset-2">
        ← Orders
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-gray-900">{customer.full_name}</h1>
      <p className="text-sm text-gray-700">{customer.email}</p>

      {account && (
        <section className="mt-8 rounded border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700">Account balance</h2>
          {/*
            Derived server-side (AUT-11); zero until Phase 2 adds transactions.
            Rendered as an explicit zero rather than "no balance" — a real zero
            and a missing value must not look the same.
          */}
          <p className="mt-1 font-mono text-2xl tabular-nums text-gray-900">{account.balance}</p>
          <p className="mt-1 text-xs text-gray-600">
            Derived from transactions. Zero until credits exist.
          </p>
        </section>
      )}
    </main>
  );
}
