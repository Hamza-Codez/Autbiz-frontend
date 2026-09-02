/**
 * The shell's navigation, per `SPEC/spec01-frontend.md` §Tests — the fourth
 * test that had nowhere to live in Phase 0, because the shell had no navigation
 * to drive until Phase 1 added a screen to navigate to.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const get = vi.fn();
vi.mock('@/lib/api', () => ({
  api: { GET: (...args: unknown[]) => get(...args), POST: vi.fn() },
}));

import Home from '@/app/page';

function user(permissions: string[]) {
  return {
    data: {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'a@example.com',
      full_name: 'Ada Lovelace',
      permissions,
    },
  };
}

beforeEach(() => {
  push.mockReset();
  get.mockReset();
});

describe('shell navigation', () => {
  it('renders navigation for a permission the user holds', async () => {
    get.mockResolvedValue(user(['orders:read']));

    render(<Home />);

    const link = await screen.findByRole('link', { name: /orders/i });
    expect(link).toHaveAttribute('href', '/orders');
  });

  it('renders no navigation for an empty permission list, and does not crash', async () => {
    get.mockResolvedValue(user([]));

    render(<Home />);

    expect(await screen.findByText(/no sections are available/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /orders/i })).not.toBeInTheDocument();
    // The shell itself must still render — an empty nav is not an error state.
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('ignores a permission it does not recognise', async () => {
    // The backend may ship a new permission before this file knows about it.
    // Rendering the raw key would put debug output on screen; crashing would be
    // worse.
    get.mockResolvedValue(user(['orders:read', 'something:invented']));

    render(<Home />);

    await screen.findByRole('link', { name: /orders/i });
    expect(screen.queryByText('something:invented')).not.toBeInTheDocument();
  });

  it('shows a loading state rather than flashing the login screen', async () => {
    // Flashing login at a signed-in user on every refresh is the most common way
    // this gets built wrong.
    get.mockReturnValue(new Promise(() => {}));

    render(<Home />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
