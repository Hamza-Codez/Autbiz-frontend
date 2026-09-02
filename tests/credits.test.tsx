/**
 * Phase 2 screens, per `SPEC/spec03-frontend.md` §Tests.
 *
 * The assertion that matters most is that a **202 never renders as applied**.
 * That defect looks correct in every screenshot and is discovered by a customer
 * who was told they had been credited and had not.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams() }));

const get = vi.fn();
const post = vi.fn();
vi.mock('@/lib/api', () => ({
  api: { GET: (...a: unknown[]) => get(...a), POST: (...a: unknown[]) => post(...a) },
}));

import ApprovalsPage from '@/app/approvals/page';
import { ProposeCredit } from '@/components/ProposeCredit';

const ORDER = {
  id: '11111111-1111-1111-1111-111111111111',
  customer_id: '22222222-2222-2222-2222-222222222222',
  status: 'PLACED',
  placed_at: '2026-08-20T00:00:00Z',
  revision: 3,
  items: [],
  issues: [
    {
      id: '33333333-3333-3333-3333-333333333333',
      order_id: '11111111-1111-1111-1111-111111111111',
      issue_type: 'DAMAGED',
      affected_item_ids: ['44444444-4444-4444-4444-444444444444'],
      status: 'OPEN',
      reported_at: '2026-08-21T00:00:00Z',
    },
  ],
};

const ADJUSTMENT = {
  id: '55555555-5555-5555-5555-555555555555',
  order_id: ORDER.id,
  issue_id: ORDER.issues[0].id,
  amount: '20.00',
  basis: {
    total: '20.00',
    lines: [
      {
        item_id: '44444444-4444-4444-4444-444444444444',
        sku: 'PMP-200',
        quantity: 2,
        unit_amount: '10.00',
        line_total: '20.00',
      },
    ],
  },
  computed_against_revision: 3,
  expires_at: '2026-09-03T00:00:00Z',
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  push.mockReset();
});

async function calculateThenSubmit() {
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText(/issue/i), ORDER.issues[0].id);
  await user.click(screen.getByRole('button', { name: /calculate credit/i }));
  await screen.findByLabelText(/calculated credit/i);
  await user.click(screen.getByRole('button', { name: /submit for approval/i }));
  return user;
}

describe('proposing a credit', () => {
  it('renders the server amount AND its basis, never a locally computed figure', async () => {
    post.mockResolvedValue({ data: ADJUSTMENT });
    render(<ProposeCredit order={ORDER} onChanged={vi.fn()} />);

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/issue/i), ORDER.issues[0].id);
    await user.click(screen.getByRole('button', { name: /calculate credit/i }));

    // Labelled, because the same figure also appears as a line total below.
    expect(await screen.findByLabelText(/calculated credit/i)).toHaveTextContent('20.00');
    // The itemisation, which is what makes an approver a reviewer.
    expect(screen.getByText('PMP-200')).toBeInTheDocument();
  });

  it('offers no way to type an amount, at any point', async () => {
    // AUT-2: the backend has no field to receive one, so an input here would be
    // a control that cannot work.
    post.mockResolvedValue({ data: ADJUSTMENT });
    render(<ProposeCredit order={ORDER} onChanged={vi.fn()} />);
    await calculateThenSubmit.call(null);

    for (const input of screen.queryAllByRole('textbox')) {
      expect(input).not.toHaveAttribute('name', expect.stringMatching(/amount|credit|total/i));
    }
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('renders a 202 as awaiting approval and NEVER as applied', async () => {
    post
      .mockResolvedValueOnce({ data: ADJUSTMENT })
      .mockResolvedValueOnce({
        data: {
          outcome: 'APPROVAL_REQUIRED',
          approval_request_id: '66666666-6666-6666-6666-666666666666',
          adjustment_id: ADJUSTMENT.id,
          amount: '20.00',
          expires_at: '2026-09-03T00:00:00Z',
        },
      });

    render(<ProposeCredit order={ORDER} onChanged={vi.fn()} />);
    await calculateThenSubmit();

    expect(await screen.findByText(/awaiting approval/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing has been applied yet/i)).toBeInTheDocument();

    // The words that must never appear on a 202.
    expect(screen.queryByText(/credit applied/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bapplied successfully\b/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^success$/i)).not.toBeInTheDocument();
  });

  it('renders the envelope message when the order is outside the credit window', async () => {
    post.mockResolvedValue({
      error: {
        error: {
          code: 'ORDER_OUTSIDE_CREDIT_WINDOW',
          message: 'This order is more than 30 days old, so it is no longer eligible.',
        },
      },
    });
    render(<ProposeCredit order={ORDER} onChanged={vi.fn()} />);

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/issue/i), ORDER.issues[0].id);
    await user.click(screen.getByRole('button', { name: /calculate credit/i }));

    expect(await screen.findByText(/more than 30 days old/i)).toBeInTheDocument();
  });

  it('explains itself when the order has no open issue to credit', () => {
    render(<ProposeCredit order={{ ...ORDER, issues: [] }} onChanged={vi.fn()} />);

    expect(screen.getByText(/no open issues on this order/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /calculate/i })).not.toBeInTheDocument();
  });
});

function queueRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '66666666-6666-6666-6666-666666666666',
    adjustment_id: ADJUSTMENT.id,
    order_id: ORDER.id,
    issue_id: ORDER.issues[0].id,
    amount: '20.00',
    basis: ADJUSTMENT.basis,
    initiated_by: '77777777-7777-7777-7777-777777777777',
    status: 'PENDING',
    expires_at: '2026-09-03T00:00:00Z',
    is_expired: false,
    ...overrides,
  };
}

function mockQueue(rows: unknown[], meId: string) {
  get.mockImplementation((path: string) =>
    path === '/approvals'
      ? Promise.resolve({ data: rows })
      : Promise.resolve({
          data: { id: meId, email: 'a@b.co', full_name: 'A', permissions: ['approvals:write'] },
        }),
  );
}

describe('approvals queue', () => {
  it('offers approve and reject on a proposal made by someone else', async () => {
    mockQueue([queueRow()], '88888888-8888-8888-8888-888888888888');
    render(<ApprovalsPage />);

    expect(await screen.findByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
  });

  it('hides the approve control on your own proposal, and says why', async () => {
    // UX only — AUT-4 refuses it at the database regardless. But a button that
    // always fails is a bad button.
    const me = '77777777-7777-7777-7777-777777777777';
    mockQueue([queueRow({ initiated_by: me })], me);
    render(<ApprovalsPage />);

    expect(await screen.findByText(/you proposed this/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
  });

  it('renders an expired row as expired and offers no approve control', async () => {
    // AUT-11: expiry is evaluated server-side on read, so a row can arrive
    // already expired with no write having happened.
    mockQueue([queueRow({ is_expired: true })], '88888888-8888-8888-8888-888888888888');
    render(<ApprovalsPage />);

    expect(await screen.findByText(/^expired$/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
  });

  it('shows the basis so an approver can review rather than rubber-stamp', async () => {
    mockQueue([queueRow()], '88888888-8888-8888-8888-888888888888');
    render(<ApprovalsPage />);

    expect(await screen.findByText(/PMP-200/)).toBeInTheDocument();
  });

  it('renders the two staleness refusals verbatim and distinctly', async () => {
    // §8 gives STALE_CALCULATION and PROPOSAL_EXPIRED different messages because
    // they are different situations. Rendering the envelope keeps that.
    mockQueue([queueRow()], '88888888-8888-8888-8888-888888888888');
    post.mockResolvedValue({
      error: {
        error: {
          code: 'STALE_CALCULATION',
          message:
            'The order changed after this credit was proposed, so the 20.00 figure may no longer be correct. Re-run the calculation and submit a new approval.',
        },
      },
    });
    render(<ApprovalsPage />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /approve/i }));

    await waitFor(() =>
      expect(screen.getByText(/Re-run the calculation and submit a new approval/i)).toBeInTheDocument(),
    );
  });
});
