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
  activeRole: string;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (fullName: string, email: string, password: string, extra?: Record<string, any>) => Promise<RegisterResult>;
  logout: () => void;
  switchRole: (role: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  activeRole: "",
  login: async () => ({}),
  register: async () => ({ message: "", requiresVerification: false, requiresApproval: false }),
  logout: () => {},
  switchRole: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState<string>("");
  const [, setLocation] = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      api.me().then(u => {
        setUser(u);
        const savedRole = localStorage.getItem(`activeRole_${u.id}`);
        const allRoles = u.roles && u.roles.length > 0 ? u.roles : [u.role];
        if (savedRole && allRoles.includes(savedRole)) {
          setActiveRole(savedRole);
          setUser({ ...u, role: savedRole });
        } else {
          setActiveRole(u.role);
        }
      }).catch(() => clearToken()).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const res = await api.login({ email, password });
    setToken(res.token);
    const savedRole = localStorage.getItem(`activeRole_${res.user.id}`);
    const allRoles = res.user.roles && res.user.roles.length > 0 ? res.user.roles : [res.user.role];
    if (savedRole && allRoles.includes(savedRole)) {
      setUser({ ...res.user, role: savedRole });
      setActiveRole(savedRole);
    } else {
      setUser(res.user);
      setActiveRole(res.user.role);
    }
    return { mustChangePassword: res.mustChangePassword };
  };

  const register = async (fullName: string, email: string, password: string, extra?: Record<string, any>): Promise<RegisterResult> => {
    const res = await api.register({ fullName, email, password, ...extra });
    return res as RegisterResult;
  };

  const switchRole = (role: string) => {
    if (!user) return;
    const allRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
    if (!allRoles.includes(role)) return;
    setActiveRole(role);
    setUser({ ...user, role });
    localStorage.setItem(`activeRole_${user.id}`, role);
    setLocation("/dashboard");
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setActiveRole("");
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, activeRole, login, register, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
