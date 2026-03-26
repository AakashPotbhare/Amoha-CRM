import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { useContext } from 'react';
import { AuthProvider, useAuth } from '../AuthContext';
import type { Employee } from '../AuthContext';

// ── Mock @/lib/api.client ─────────────────────────────────────────────────────
// We hoist vi.mock so it runs before any imports. The factory must be a
// plain function — no top-level variable references allowed at hoist time.

vi.mock('@/lib/api.client', () => {
  const mockGet  = vi.fn();
  const mockPost = vi.fn();

  return {
    api: {
      get:    mockGet,
      post:   mockPost,
      patch:  vi.fn(),
      put:    vi.fn(),
      delete: vi.fn(),
    },
    getToken:   vi.fn(),
    setToken:   vi.fn(),
    clearToken: vi.fn(),
  };
});

// ── Typed imports of the mocked module ───────────────────────────────────────
// These are retrieved AFTER vi.mock has replaced the module.
import { api, getToken, setToken, clearToken } from '@/lib/api.client';

const mockGetToken   = vi.mocked(getToken);
const mockSetToken   = vi.mocked(setToken);
const mockClearToken = vi.mocked(clearToken);
const mockApiGet     = vi.mocked(api.get);
const mockApiPost    = vi.mocked(api.post);

// ── Fixture data ──────────────────────────────────────────────────────────────

const fakeEmployee: Employee = {
  id:              'emp-1',
  employee_code:   'EMP001',
  full_name:       'Jane Doe',
  email:           'jane@example.com',
  phone:           null,
  role:            'recruiter',
  department_id:   'dept-1',
  team_id:         'team-1',
  is_active:       true,
  joining_date:    null,
  salary:          null,
  departments:     { name: 'Technical', slug: 'technical' },
  teams:           { name: 'Alpha' },
  dept_name:       'Technical',
  dept_slug:       'technical',
  team_name:       'Alpha',
};

// ── Helper components ─────────────────────────────────────────────────────────

/** Renders auth state so we can assert against it via the DOM. */
function AuthConsumer() {
  const { employee, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="employee">{employee ? employee.full_name : 'null'}</span>
    </div>
  );
}

/** Renders a sign-in trigger button and result. */
function SignInConsumer() {
  const { signIn, employee } = useAuth();

  async function handleSignIn() {
    await signIn('EMP001', 'secret');
  }

  return (
    <div>
      <button onClick={handleSignIn}>Sign In</button>
      <span data-testid="employee">{employee ? employee.full_name : 'null'}</span>
    </div>
  );
}

/** Renders a sign-out trigger button. */
function SignOutConsumer() {
  const { signOut, employee } = useAuth();
  return (
    <div>
      <button onClick={signOut}>Sign Out</button>
      <span data-testid="employee">{employee ? employee.full_name : 'null'}</span>
    </div>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no token stored → loading settles to false quickly
    mockGetToken.mockReturnValue(null);
  });

  // ── Provider renders ───────────────────────────────────────────────────────

  it('renders children inside AuthProvider without crashing', async () => {
    render(
      <AuthProvider>
        <div>Child content</div>
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByText('Child content')).toBeInTheDocument()
    );
  });

  // ── Initial state: no token ────────────────────────────────────────────────

  it('starts with loading=true then resolves to loading=false when no token exists', async () => {
    mockGetToken.mockReturnValue(null);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    // Eventually loading must settle to false
    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    );
  });

  it('starts with employee=null when no token exists', async () => {
    mockGetToken.mockReturnValue(null);

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    );

    expect(screen.getByTestId('employee')).toHaveTextContent('null');
  });

  // ── Initial state: token present → fetch /api/auth/me ─────────────────────

  it('fetches /api/auth/me on mount when a token exists and sets employee', async () => {
    mockGetToken.mockReturnValue('existing-jwt');
    mockApiGet.mockResolvedValueOnce({ success: true, data: fakeEmployee });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('employee')).toHaveTextContent('Jane Doe')
    );
    expect(mockApiGet).toHaveBeenCalledWith('/api/auth/me');
  });

  it('clears the token and leaves employee=null when /api/auth/me rejects', async () => {
    mockGetToken.mockReturnValue('bad-jwt');
    mockApiGet.mockRejectedValueOnce(new Error('Unauthorized'));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    );

    expect(mockClearToken).toHaveBeenCalledOnce();
    expect(screen.getByTestId('employee')).toHaveTextContent('null');
  });

  // ── signIn ─────────────────────────────────────────────────────────────────

  it('sets employee state after a successful signIn', async () => {
    mockGetToken.mockReturnValue(null);
    mockApiPost.mockResolvedValueOnce({
      success: true,
      data: { token: 'new-jwt', employee: fakeEmployee },
    });

    render(
      <AuthProvider>
        <SignInConsumer />
      </AuthProvider>
    );

    // Wait for the initial loading to settle
    await waitFor(() =>
      expect(screen.getByTestId('employee')).toHaveTextContent('null')
    );

    await act(async () => {
      screen.getByRole('button', { name: 'Sign In' }).click();
    });

    await waitFor(() =>
      expect(screen.getByTestId('employee')).toHaveTextContent('Jane Doe')
    );
  });

  it('calls setToken with the returned JWT after successful login', async () => {
    mockGetToken.mockReturnValue(null);
    mockApiPost.mockResolvedValueOnce({
      success: true,
      data: { token: 'new-jwt', employee: fakeEmployee },
    });

    render(
      <AuthProvider>
        <SignInConsumer />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('employee')).toHaveTextContent('null')
    );

    await act(async () => {
      screen.getByRole('button', { name: 'Sign In' }).click();
    });

    await waitFor(() =>
      expect(mockSetToken).toHaveBeenCalledWith('new-jwt')
    );
  });

  it('returns { error: null } on a successful signIn', async () => {
    mockGetToken.mockReturnValue(null);
    mockApiPost.mockResolvedValueOnce({
      success: true,
      data: { token: 'new-jwt', employee: fakeEmployee },
    });

    let result: { error: string | null } | undefined;

    function SignInResultConsumer() {
      const { signIn } = useAuth();
      async function handleSignIn() {
        result = await signIn('EMP001', 'secret');
      }
      return <button onClick={handleSignIn}>Sign In</button>;
    }

    render(
      <AuthProvider>
        <SignInResultConsumer />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByRole('button', { name: 'Sign In' }).click();
    });

    await waitFor(() => expect(result).toBeDefined());
    expect(result!.error).toBeNull();
  });

  it('returns { error: message } when signIn fails', async () => {
    mockGetToken.mockReturnValue(null);
    mockApiPost.mockRejectedValueOnce(new Error('Invalid credentials'));

    let result: { error: string | null } | undefined;

    function SignInErrorConsumer() {
      const { signIn } = useAuth();
      async function handleSignIn() {
        result = await signIn('EMP001', 'wrong-password');
      }
      return <button onClick={handleSignIn}>Sign In</button>;
    }

    render(
      <AuthProvider>
        <SignInErrorConsumer />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByRole('button', { name: 'Sign In' }).click();
    });

    await waitFor(() => expect(result).toBeDefined());
    expect(result!.error).toBe('Invalid credentials');
  });

  // ── signOut ────────────────────────────────────────────────────────────────

  it('clears employee and calls clearToken on signOut', async () => {
    // Simulate being logged in at mount
    mockGetToken.mockReturnValue('active-jwt');
    mockApiGet.mockResolvedValueOnce({ success: true, data: fakeEmployee });

    render(
      <AuthProvider>
        <SignOutConsumer />
      </AuthProvider>
    );

    // Wait until the employee is loaded
    await waitFor(() =>
      expect(screen.getByTestId('employee')).toHaveTextContent('Jane Doe')
    );

    await act(async () => {
      screen.getByRole('button', { name: 'Sign Out' }).click();
    });

    expect(mockClearToken).toHaveBeenCalled();
    expect(screen.getByTestId('employee')).toHaveTextContent('null');
  });

  // ── useAuth hook ───────────────────────────────────────────────────────────

  it('useAuth returns the expected context shape', async () => {
    mockGetToken.mockReturnValue(null);

    let auth: ReturnType<typeof useAuth> | undefined;

    function ContextInspector() {
      auth = useAuth();
      return null;
    }

    render(
      <AuthProvider>
        <ContextInspector />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(auth).toBeDefined();
    });

    expect(auth).toHaveProperty('employee');
    expect(auth).toHaveProperty('loading');
    expect(auth).toHaveProperty('signIn');
    expect(auth).toHaveProperty('signOut');
    expect(typeof auth!.signIn).toBe('function');
    expect(typeof auth!.signOut).toBe('function');
  });

  // ── normaliseEmployee ──────────────────────────────────────────────────────
  // The context normalises flat dept_name / dept_slug / team_name columns into
  // nested `departments` and `teams` objects. Verify through the public API.

  it('normalises flat employee columns into nested departments/teams objects', async () => {
    const flatEmployee: Employee = {
      ...fakeEmployee,
      // Remove nested objects to simulate the flat server response
      departments: undefined as unknown as Employee['departments'],
      teams:       undefined as unknown as Employee['teams'],
      dept_name:   'Sales',
      dept_slug:   'sales',
      team_name:   'Beta',
    };

    mockGetToken.mockReturnValue('jwt');
    mockApiGet.mockResolvedValueOnce({ success: true, data: flatEmployee });

    let capturedEmployee: Employee | null = null;

    function EmployeeInspector() {
      const { employee } = useAuth();
      capturedEmployee = employee;
      return null;
    }

    render(
      <AuthProvider>
        <EmployeeInspector />
      </AuthProvider>
    );

    await waitFor(() => expect(capturedEmployee).not.toBeNull());

    expect(capturedEmployee!.departments).toEqual({ name: 'Sales', slug: 'sales' });
    expect(capturedEmployee!.teams).toEqual({ name: 'Beta' });
  });
});
