import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api, setToken, clearToken, registerPushNotifications } from "./api";
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
  const [activeRole, setActiveRole] = useState<string>(() => {
    return localStorage.getItem("afrocat_active_role") || "";
  });
  const [, setLocation] = useLocation();

  function resolveRole(savedRole: string | null, allRoles: string[]): string {
    if (savedRole && allRoles.includes(savedRole)) return savedRole;
    if (allRoles.includes("COACH")) return "COACH";
    if (allRoles.includes("PLAYER")) return "PLAYER";
    return allRoles[0] || "PLAYER";
  }

  function getAllRoles(u: any): string[] {
    const roles = u.roles && u.roles.length > 0 ? [...u.roles] : [u.role];
    if (u.isSuperAdmin && !roles.includes("ADMIN")) roles.unshift("ADMIN");
    return roles;
  }

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      api.me().then(u => {
        const allRoles = getAllRoles(u);
        const saved = localStorage.getItem("afrocat_active_role");
        const resolved = resolveRole(saved, allRoles);
        setActiveRole(resolved);
        localStorage.setItem("afrocat_active_role", resolved);
        setUser({ ...u, role: resolved });
      }).catch(() => clearToken()).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const res = await api.login({ email, password });
    setToken(res.token);
    const allRoles = getAllRoles(res.user);
    const saved = localStorage.getItem("afrocat_active_role");
    const resolved = resolveRole(saved, allRoles);
    setActiveRole(resolved);
    localStorage.setItem("afrocat_active_role", resolved);
    setUser({ ...res.user, role: resolved });
    registerPushNotifications();
    return { mustChangePassword: res.mustChangePassword };
  };

  const register = async (fullName: string, email: string, password: string, extra?: Record<string, any>): Promise<RegisterResult> => {
    const res = await api.register({ fullName, email, password, ...extra });
    return res as RegisterResult;
  };

  const switchRole = (role: string) => {
    if (!user) return;
    const allRoles = getAllRoles(user);
    if (!allRoles.includes(role)) return;
    setActiveRole(role);
    setUser({ ...user, role });
    localStorage.setItem("afrocat_active_role", role);
    setLocation("/dashboard");
  };

  const logout = () => {
    clearToken();
    localStorage.removeItem("afrocat_active_role");
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
