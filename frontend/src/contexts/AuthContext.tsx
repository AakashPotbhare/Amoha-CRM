import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, getToken, setToken, clearToken } from '@/lib/api.client';
import type { EmployeeRole } from '@/types/domain.types';

export interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url?: string | null;
  role: EmployeeRole;
  department_id: string;
  team_id: string | null;
  is_active: boolean;
  joining_date: string | null;
  salary: number | null;
  departments: { name: string; slug: string };
  teams: { name: string };
  dept_name: string;
  dept_slug: string;
  team_name: string;
}

interface AuthContextType {
  employee: Employee | null;
  loading: boolean;
  signIn: (employeeCode: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading,  setLoading]  = useState(true);

  // On mount: if a token exists, fetch current employee to restore session
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    api.get<Employee>('/api/auth/me')
      .then(res => setEmployee(normaliseEmployee(res.data)))
      .catch(() => clearToken())   // expired / invalid token — wipe it
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (employeeCode: string, password: string): Promise<{ error: string | null }> => {
    try {
      const res = await api.post<{ token: string; employee: Employee }>(
        '/api/auth/login',
        { employeeCode, password }
      );
      setToken(res.data.token);
      setEmployee(normaliseEmployee(res.data.employee));
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : 'Login failed' };
    }
  };

  const signOut = () => {
    clearToken();
    setEmployee(null);
  };

  return (
    <AuthContext.Provider value={{ employee, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// The backend returns flat columns (dept_name, dept_slug, team_name).
// Map them to nested objects so existing pages that read `employee.departments.name` keep working.
function normaliseEmployee(emp: Employee): Employee {
  return {
    ...emp,
    departments: emp.departments ?? { name: emp.dept_name, slug: emp.dept_slug },
    teams:       emp.teams       ?? { name: emp.team_name },
  };
}
