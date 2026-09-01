/**
 * Component tests for the login screen, per `SPEC/spec01-frontend.md` §Tests.
 *
 * These live in `tests/`, deliberately outside `src/app/`. A test file inside
 * the routable app directory fails `next build` with an error naming neither
 * the file nor the cause, while lint, type check and the test runner all stay
 * green — so the app would not have deployed and nothing would have said why.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const post = vi.fn();
vi.mock('@/lib/api', () => ({
  api: { POST: (...args: unknown[]) => post(...args) },
}));

import LoginPage from '@/app/login/page';

const ENVELOPE_MESSAGE = 'Email or password is incorrect.';

async function submit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/email/i), 'someone@example.com');
  await user.type(screen.getByLabelText(/password/i), 'a-long-passphrase');
  await user.click(screen.getByRole('button', { name: /sign in/i }));
  return user;
}

beforeEach(() => {
  push.mockReset();
  post.mockReset();
});

describe('login', () => {
  it('disables submit while a request is in flight and re-enables it on failure', async () => {
    // Network latency makes people double-click; an un-guarded submit sends the
    // request twice.
    let release!: (v: unknown) => void;
    post.mockReturnValue(new Promise((resolve) => { release = resolve; }));

    render(<LoginPage />);
    await submit();

    const button = screen.getByRole('button', { name: /signing in|sign in/i });
    expect(button).toBeDisabled();

    release({ error: { error: { code: 'INVALID_CREDENTIALS', message: ENVELOPE_MESSAGE } } });
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it('renders the envelope message on 401, not a hardcoded string', async () => {
    // The backend returns an identical body for unknown email, wrong password
    // and inactive user by design. Substituting local copy per case would
    // reintroduce the account-enumeration leak at the last hop.
    post.mockResolvedValue({
      error: { error: { code: 'INVALID_CREDENTIALS', message: ENVELOPE_MESSAGE } },
    });

    render(<LoginPage />);
    await submit();

    expect(await screen.findByText(ENVELOPE_MESSAGE)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('renders a transport failure distinctly from a 401', async () => {
    // Presenting a network problem as bad credentials sends the user to reset a
    // password that was never wrong.
    post.mockRejectedValue(new TypeError('Failed to fetch'));

    render(<LoginPage />);
    await submit();

    const message = await screen.findByText(/network/i);
    expect(message).toBeInTheDocument();
    expect(screen.queryByText(ENVELOPE_MESSAGE)).not.toBeInTheDocument();
  });

  it('redirects to the shell on success', async () => {
    post.mockResolvedValue({ data: { id: 'u1', email: 'a@b.co', full_name: 'A', permissions: [] } });

    render(<LoginPage />);
    await submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });
});
