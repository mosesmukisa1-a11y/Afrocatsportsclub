import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, Users, Trophy, ClipboardList, 
  CalendarCheck, DollarSign, Activity, FileText, 
  LogOut, ShieldAlert, Award, Menu, X, Star,
  ScrollText, FolderOpen, UserCircle, UserCheck,
  BarChart3, MessageCircle, Gamepad2, FileSpreadsheet,
  Gauge, ChevronDown, RefreshCw, Mail, BookOpen, Image, Mic, Wrench, FileDown
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "./MobileNav";
import logo from "@assets/afrocate_logo_1772226294597.png";
import { useState } from "react";

const allNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", roles: ["ADMIN","MANAGER","COACH","CAPTAIN","STATISTICIAN","FINANCE","MEDICAL","PLAYER"] },
  { icon: Users, label: "Teams", href: "/teams", roles: ["ADMIN","MANAGER","COACH","CAPTAIN","STATISTICIAN","FINANCE","MEDICAL"] },
  { icon: Users, label: "Players", href: "/players", roles: ["ADMIN","MANAGER","COACH","CAPTAIN","STATISTICIAN","FINANCE","MEDICAL"] },
  { icon: Trophy, label: "Matches", href: "/matches", roles: ["ADMIN","MANAGER","COACH","STATISTICIAN"] },
  { icon: ClipboardList, label: "Enter Stats", href: "/stats", roles: ["ADMIN","MANAGER","COACH","STATISTICIAN"] },
  { icon: Gauge, label: "Coach Dashboard", href: "/coach-dashboard", roles: ["ADMIN","MANAGER","COACH","STATISTICIAN"] },
  { icon: CalendarCheck, label: "Attendance", href: "/attendance", roles: ["ADMIN","MANAGER","COACH"] },
  { icon: DollarSign, label: "Finance", href: "/finance", roles: ["ADMIN","MANAGER","FINANCE"] },
  { icon: Activity, label: "Injuries", href: "/injuries", roles: ["ADMIN","MANAGER","MEDICAL"] },
  { icon: Award, label: "Awards", href: "/awards", roles: ["ADMIN","MANAGER","COACH"] },
  { icon: Star, label: "Coaches", href: "/coaches", roles: ["ADMIN","MANAGER"] },
  { icon: ScrollText, label: "Contracts", href: "/contracts", roles: ["ADMIN","MANAGER","COACH"] },
  { icon: FolderOpen, label: "Documents", href: "/documents", roles: ["ADMIN","MANAGER","COACH"] },
  { icon: Users, label: "Player Stats", href: "/player-dashboard", roles: ["ADMIN","MANAGER","COACH","PLAYER"] },
  { icon: ScrollText, label: "My Contract", href: "/my-contract", roles: ["PLAYER"] },
  { icon: FileText, label: "Club Contract", href: "/club-contract", roles: ["ADMIN","MANAGER","COACH","CAPTAIN","STATISTICIAN","FINANCE","MEDICAL","PLAYER"] },
  { icon: Image, label: "Media", href: "/media-gallery", roles: ["ADMIN","MANAGER","COACH","CAPTAIN","STATISTICIAN","FINANCE","MEDICAL","PLAYER"] },
  { icon: Mic, label: "Interviews", href: "/interviews", roles: ["ADMIN","MANAGER","COACH","CAPTAIN","STATISTICIAN","FINANCE","MEDICAL","PLAYER"] },
  { icon: BarChart3, label: "Compare Stats", href: "/stats-comparison", roles: ["ADMIN","MANAGER","COACH","STATISTICIAN","PLAYER"] },
  { icon: BookOpen, label: "Coach's Corner", href: "/coach-blog", roles: ["ADMIN","MANAGER","COACH","CAPTAIN","STATISTICIAN","FINANCE","MEDICAL","PLAYER"] },
  { icon: MessageCircle, label: "Chat", href: "/chat", roles: ["ADMIN","MANAGER","COACH","CAPTAIN","STATISTICIAN","PLAYER"] },
  { icon: Mail, label: "Send Email", href: "/email-compose", roles: ["ADMIN","MANAGER"] },
  { icon: ShieldAlert, label: "Officials", href: "/officials", roles: ["ADMIN","MANAGER"] },
  { icon: Gamepad2, label: "Simulation", href: "/match-simulation", roles: ["ADMIN","MANAGER","COACH"] },
  { icon: FileSpreadsheet, label: "Report Builder", href: "/report-templates", roles: ["ADMIN","MANAGER","COACH","STATISTICIAN","FINANCE"] },
  { icon: UserCircle, label: "My Profile", href: "/profile-setup", roles: ["PLAYER"] },
  { icon: UserCheck, label: "Registrations", href: "/admin/registrations", roles: ["ADMIN","MANAGER"] },
  { icon: FileDown, label: "Member Extract", href: "/admin/member-extract", roles: ["ADMIN","MANAGER"] },
  { icon: ShieldAlert, label: "User Management", href: "/admin/users", roles: ["ADMIN"] },
  { icon: Wrench, label: "System Check", href: "/admin/system-check", roles: ["ADMIN"] },
];

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  ADMIN: { bg: "bg-afrocat-gold-soft", text: "text-afrocat-gold" },
  MANAGER: { bg: "bg-purple-500/10", text: "text-purple-400" },
  COACH: { bg: "bg-afrocat-teal-soft", text: "text-afrocat-teal" },
  CAPTAIN: { bg: "bg-blue-500/10", text: "text-blue-400" },
  STATISTICIAN: { bg: "bg-cyan-500/10", text: "text-cyan-400" },
  FINANCE: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  MEDICAL: { bg: "bg-rose-500/10", text: "text-rose-400" },
  PLAYER: { bg: "bg-afrocat-green-soft", text: "text-afrocat-green" },
};

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout, activeRole, switchRole } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);

  const userRoles = (() => {
    if (!user) return [];
    const roles = user.roles && user.roles.length > 0 ? [...user.roles] : [user.role];
    if (user.isSuperAdmin && !roles.includes("ADMIN")) roles.unshift("ADMIN");
    return roles;
  })();
  const hasMultipleRoles = userRoles.length > 1;
  const currentRoleColor = ROLE_COLORS[activeRole || user?.role || ""] || ROLE_COLORS.PLAYER;
  const effectiveRole = activeRole || user?.role || "";
  const navItems = allNavItems.filter(item => {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    if (item.roles.includes(effectiveRole)) return true;
    return false;
  });

  return (
    <div className="min-h-screen bg-afrocat-bg text-afrocat-text flex flex-col md:flex-row">
      <div className="md:hidden flex items-center justify-between p-4 border-b border-afrocat-border bg-afrocat-card">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Afrocat Logo" className="w-8 h-8 object-contain" />
          <span className="font-display font-bold text-afrocat-text">Afrocat Portal</span>
        </div>
        <div className="flex items-center gap-2">
          {hasMultipleRoles && (
            <span className={`text-[10px] font-bold px-2 py-1 rounded ${currentRoleColor.bg} ${currentRoleColor.text} uppercase tracking-wider`}>
              {effectiveRole}
            </span>
          )}
          <button onClick={() => setMobileOpen(!mobileOpen)} data-testid="button-mobile-menu" className="text-afrocat-text">
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <aside
        className={`${mobileOpen ? 'block' : 'hidden'} md:block w-full md:w-64 border-r border-afrocat-border bg-afrocat-card flex flex-col`}
      >
        <div className="hidden md:flex p-6 items-center gap-3 border-b border-afrocat-border">
          <img src={logo} alt="Afrocat Logo" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="font-display font-bold text-lg leading-tight tracking-tight text-afrocat-text">
              Afrocat Portal
            </h1>
            <p className="text-xs text-afrocat-muted font-medium">Club Management</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}
                  data-testid={`nav-link-${item.label.toLowerCase().replace(' ', '-')}`}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors text-sm font-medium ${
                    isActive 
                      ? "bg-afrocat-teal/15 text-afrocat-teal" 
                      : "text-afrocat-muted hover:bg-afrocat-white-5 hover:text-afrocat-text"
                  }`}
                >
                  <item.icon size={18} className={isActive ? "text-afrocat-teal" : "text-afrocat-muted"} />
                  {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-afrocat-border space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className={`w-8 h-8 rounded-full ${currentRoleColor.bg} flex items-center justify-center border border-afrocat-border`}>
              <ShieldAlert size={16} className={currentRoleColor.text} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-afrocat-text truncate">{user?.fullName}</p>
              <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${currentRoleColor.bg} ${currentRoleColor.text} uppercase tracking-wider`} data-testid="badge-active-role">
                {activeRole || user?.role}
              </span>
            </div>
          </div>

          {hasMultipleRoles && (
            <div className="relative">
              <button
                onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-md bg-afrocat-white-5 border border-afrocat-border hover:bg-afrocat-white-10 transition-colors text-sm"
                data-testid="button-role-switcher"
              >
                <RefreshCw size={14} className="text-afrocat-teal shrink-0" />
                <span className="text-afrocat-text font-medium flex-1 text-left">Switch Role</span>
                <ChevronDown size={14} className={`text-afrocat-muted transition-transform ${roleSwitcherOpen ? 'rotate-180' : ''}`} />
              </button>
              {roleSwitcherOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-afrocat-card border border-afrocat-border rounded-lg shadow-lg overflow-hidden z-50" data-testid="dropdown-role-switcher">
                  <div className="p-2 border-b border-afrocat-border">
                    <p className="text-[10px] font-bold text-afrocat-muted uppercase tracking-wider px-2">Switch Active Role</p>
                  </div>
                  <div className="p-1">
                    {userRoles.map((role) => {
                      const isActive = role === (activeRole || user?.role);
                      const rc = ROLE_COLORS[role] || ROLE_COLORS.PLAYER;
                      return (
                        <button
                          key={role}
                          onClick={() => { switchRole(role); setRoleSwitcherOpen(false); }}
                          className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                            isActive
                              ? `${rc.bg} ${rc.text}`
                              : "text-afrocat-muted hover:bg-afrocat-white-5 hover:text-afrocat-text"
                          }`}
                          data-testid={`button-switch-role-${role.toLowerCase()}`}
                        >
                          <div className={`w-2 h-2 rounded-full ${isActive ? rc.text.replace('text-', 'bg-') : 'bg-afrocat-white-10'}`} />
                          {role}
                          {isActive && <span className="ml-auto text-[10px] opacity-70">Active</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={logout}
            data-testid="nav-link-logout"
            className="flex items-center gap-3 px-4 py-2 w-full text-sm font-medium text-afrocat-red hover:bg-afrocat-red-soft rounded-md transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-afrocat-glow">
        <div className="p-6 md:p-10 max-w-7xl mx-auto pb-20 md:pb-0">
          {children}
        </div>
      </main>

      {user && <MobileNav onMorePress={() => setMobileOpen(true)} />}
    </div>
  );
}
