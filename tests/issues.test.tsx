/**
 * The two components that close the credit loop.
 *
 * Before they existed the product was unreachable: nothing created an
 * `OrderIssue`, so no credit could be proposed by anyone, and an approved credit
 * became invisible the moment the queue emptied.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
vi.mock('@/lib/api', () => ({
  api: { GET: (...a: unknown[]) => get(...a), POST: (...a: unknown[]) => post(...a) },
}));

import { OrderCredits } from '@/components/OrderCredits';
import { ReportIssue } from '@/components/ReportIssue';

const ORDER = {
  id: '11111111-1111-1111-1111-111111111111',
  customer_id: '22222222-2222-2222-2222-222222222222',
  status: 'PLACED',
  placed_at: '2026-08-20T00:00:00Z',
  revision: 2,
  items: [
    { id: 'aaaa1111-0000-0000-0000-000000000001', sku: 'PMP-200', description: 'Pump', quantity: 2, unit_amount: '480.00' },
    { id: 'aaaa1111-0000-0000-0000-000000000002', sku: 'SEA-14', description: 'Seal', quantity: 4, unit_amount: '35.50' },
  ],
  issues: [],
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('logging an issue', () => {
  async function openForm() {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /log an issue/i }));
    return user;
  }

  it('cannot be submitted without a description and at least one item', async () => {
    // The database enforces cardinality > 0 too; this only saves a round trip.
    render(<ReportIssue order={ORDER} onChanged={vi.fn()} />);
    const user = await openForm();

    const submit = screen.getByRole('button', { name: /^log issue$/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/what went wrong/i), 'Damaged');
    expect(submit).toBeDisabled(); // still no item selected

    await user.click(screen.getAllByRole('checkbox')[0]);
    expect(submit).toBeEnabled();
  });

  it('sends only the items that were ticked', async () => {
    // Phase 2 calculates the credit from exactly these items, so sending the
    // wrong set would credit value the issue does not cover.
    post.mockResolvedValue({ data: { id: 'x' } });
    render(<ReportIssue order={ORDER} onChanged={vi.fn()} />);
    const user = await openForm();

    await user.type(screen.getByLabelText(/what went wrong/i), 'Damaged in transit');
    await user.click(screen.getAllByRole('checkbox')[1]); // the second item only
    await user.click(screen.getByRole('button', { name: /^log issue$/i }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    const [, options] = post.mock.calls[0] as [string, { body: { issue_type: string; affected_item_ids: string[] } }];
    expect(options.body.affected_item_ids).toEqual([ORDER.items[1].id]);
    expect(options.body.issue_type).toBe('Damaged in transit');
  });

  it('renders the envelope message on refusal and stays open', async () => {
    post.mockResolvedValue({
      error: { error: { code: 'VALIDATION_ERROR', message: 'These items are not on this order.' } },
    });
    render(<ReportIssue order={ORDER} onChanged={vi.fn()} />);
    const user = await openForm();

    await user.type(screen.getByLabelText(/what went wrong/i), 'Damaged');
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByRole('button', { name: /^log issue$/i }));

    expect(await screen.findByText(/not on this order/i)).toBeInTheDocument();
    // The form must not close and discard what the user typed.
    expect(screen.getByLabelText(/what went wrong/i)).toHaveValue('Damaged');
  });

  it('warns that logging an issue makes an existing calculation stale', async () => {
    // §8: the revision bumps by trigger, so a figure computed before this is
    // refused at approval. Saying so here beats discovering it as a 409.
    render(<ReportIssue order={ORDER} onChanged={vi.fn()} />);
    await openForm();

    expect(screen.getByText(/becomes stale/i)).toBeInTheDocument();
  });
});

describe('credits issued on an order', () => {
  it('shows an approved credit, so the loop is visible', async () => {
    get.mockResolvedValue({
      response: { status: 200 },
      data: {
        items: [
          {
            id: 'c1',
            order_id: ORDER.id,
            issue_id: 'i1',
            adjustment_id: 'a1',
            amount: '960.00',
            created_at: '2026-09-02T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        size: 20,
        pages: 1,
      },
    });

    render(<OrderCredits orderId={ORDER.id} reloadKey={0} />);

    expect(await screen.findByText('960.00')).toBeInTheDocument();
  });

  it('renders nothing when the principal lacks credits:read', async () => {
    // A separate permission. Absence of the section beats an error banner for
    // something that is not a fault.
    get.mockResolvedValue({ response: { status: 403 }, error: { error: { code: 'FORBIDDEN', message: 'no' } } });

    const { container } = render(<OrderCredits orderId={ORDER.id} reloadKey={0} />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('renders nothing when there are no credits yet', async () => {
    get.mockResolvedValue({
      response: { status: 200 },
      data: { items: [], total: 0, page: 1, size: 20, pages: 1 },
    });

    const { container } = render(<OrderCredits orderId={ORDER.id} reloadKey={0} />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
