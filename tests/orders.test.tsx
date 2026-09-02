/**
 * Component tests for the Phase 1 screens, per `SPEC/spec02-frontend.md` §Tests.
 *
 * In `tests/`, never `src/app/` — a test file inside the routable app directory
 * fails `next build` with an error naming neither the file nor the cause.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}));

const get = vi.fn();
vi.mock('@/lib/api', () => ({
  api: { GET: (...args: unknown[]) => get(...args), POST: vi.fn() },
}));

import OrdersPage from '@/app/orders/page';

function order(id: string) {
  return {
    id,
    customer_id: '11111111-1111-1111-1111-111111111111',
    status: 'PLACED',
    placed_at: '2026-08-01T00:00:00Z',
    revision: 1,
  };
}

beforeEach(() => {
  push.mockReset();
  get.mockReset();
  searchParams = new URLSearchParams();
});

describe('order list', () => {
  it('renders the server total, not items.length', async () => {
    // The page shows 20 rows; the result set is 137. Rendering items.length
    // would tell the operator there are 20 orders in the system.
    get.mockResolvedValue({
      data: { items: [order('aaaaaaaa-0000-0000-0000-000000000001')], total: 137, page: 1, size: 20, pages: 7 },
    });

    render(<OrdersPage />);

    expect(await screen.findByText('137 orders')).toBeInTheDocument();
  });

  it('renders an empty state rather than an empty table', async () => {
    get.mockResolvedValue({ data: { items: [], total: 0, page: 1, size: 20, pages: 1 } });

    render(<OrdersPage />);

    expect(await screen.findByText(/no orders yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders the envelope message on failure, not a hardcoded string', async () => {
    get.mockResolvedValue({
      error: { error: { code: 'FORBIDDEN', message: 'A very specific server message.' } },
    });

    render(<OrdersPage />);

    expect(await screen.findByText('A very specific server message.')).toBeInTheDocument();
  });

  it('renders a transport failure distinctly from an API error', async () => {
    // Presenting a dead backend as an authorization problem sends the operator
    // to ask for permissions they already have.
    get.mockRejectedValue(new TypeError('Failed to fetch'));

    render(<OrdersPage />);

    expect(await screen.findByText(/network error/i)).toBeInTheDocument();
  });

  it('does not show pagination when there is only one page', async () => {
    get.mockResolvedValue({
      data: { items: [order('aaaaaaaa-0000-0000-0000-000000000001')], total: 1, page: 1, size: 20, pages: 1 },
    });

    render(<OrdersPage />);

    await screen.findByText('1 order');
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
  });

  it('requests the page named in the URL, using page and size — never limit', async () => {
    // Project 1 capped a dropdown at 20 rows for weeks because it sent `limit`,
    // which the backend ignored. This one rejects unknown parameters, but the
    // point is not to send one.
    searchParams = new URLSearchParams('page=3');
    get.mockResolvedValue({ data: { items: [], total: 0, page: 3, size: 20, pages: 3 } });

    render(<OrdersPage />);

    await waitFor(() => expect(get).toHaveBeenCalled());
    const [, options] = get.mock.calls[0] as [string, { params: { query: Record<string, unknown> } }];
    expect(options.params.query).toEqual({ page: 3, size: 20 });
    expect(Object.keys(options.params.query)).not.toContain('limit');
  });
});
