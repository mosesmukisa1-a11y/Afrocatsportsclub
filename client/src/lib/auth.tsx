import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api, setToken, clearToken } from "./api";
import { useLocation } from "wouter";

interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  roles?: string[];
  isSuperAdmin?: boolean;
  playerId?: string;
  mustChangePassword?: boolean;
}

interface RegisterResult {
  message: string;
  requiresVerification: boolean;
  requiresApproval: boolean;
  verificationLink?: string;
}

interface LoginResult {
  mustChangePassword?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (fullName: string, email: string, password: string, extra?: Record<string, any>) => Promise<RegisterResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({}),
  register: async () => ({ message: "", requiresVerification: false, requiresApproval: false }),
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      api.me().then(u => setUser(u)).catch(() => clearToken()).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const res = await api.login({ email, password });
    setToken(res.token);
    setUser(res.user);
    return { mustChangePassword: res.mustChangePassword };
  };

  const register = async (fullName: string, email: string, password: string, extra?: Record<string, any>): Promise<RegisterResult> => {
    const res = await api.register({ fullName, email, password, ...extra });
    return res as RegisterResult;
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
