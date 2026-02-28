import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, Users, Trophy, ClipboardList, 
  CalendarCheck, DollarSign, Activity, FileText, 
  LogOut, ShieldAlert, Award, Menu, X, Star,
  ScrollText, FolderOpen, UserCircle, UserCheck
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import logo from "@assets/afrocate_logo_1772226294597.png";
import { useState } from "react";

const allNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", roles: ["ADMIN","MANAGER","COACH","STATISTICIAN","FINANCE","MEDICAL","PLAYER"] },
  { icon: Users, label: "Teams", href: "/teams", roles: ["ADMIN","MANAGER","COACH","STATISTICIAN","FINANCE","MEDICAL"] },
  { icon: Users, label: "Players", href: "/players", roles: ["ADMIN","MANAGER","COACH","STATISTICIAN","FINANCE","MEDICAL"] },
  { icon: Trophy, label: "Matches", href: "/matches", roles: ["ADMIN","MANAGER","COACH","STATISTICIAN"] },
  { icon: ClipboardList, label: "Enter Stats", href: "/stats", roles: ["ADMIN","MANAGER","STATISTICIAN","COACH"] },
  { icon: CalendarCheck, label: "Attendance", href: "/attendance", roles: ["ADMIN","MANAGER","COACH"] },
  { icon: DollarSign, label: "Finance", href: "/finance", roles: ["ADMIN","MANAGER","FINANCE"] },
  { icon: Activity, label: "Injuries", href: "/injuries", roles: ["ADMIN","MANAGER","MEDICAL"] },
  { icon: Award, label: "Awards", href: "/awards", roles: ["ADMIN","MANAGER","COACH"] },
  { icon: Star, label: "Coaches", href: "/coaches", roles: ["ADMIN","MANAGER"] },
  { icon: ScrollText, label: "Contracts", href: "/contracts", roles: ["ADMIN","MANAGER","COACH"] },
  { icon: FolderOpen, label: "Documents", href: "/documents", roles: ["ADMIN","MANAGER","COACH"] },
  { icon: FileText, label: "Reports", href: "/reports", roles: ["ADMIN","MANAGER","COACH","STATISTICIAN"] },
  { icon: Users, label: "Player Stats", href: "/player-dashboard", roles: ["ADMIN","MANAGER","COACH","PLAYER"] },
  { icon: UserCircle, label: "My Profile", href: "/profile-setup", roles: ["PLAYER"] },
  { icon: UserCheck, label: "Registrations", href: "/admin/registrations", roles: ["ADMIN","MANAGER"] },
  { icon: ShieldAlert, label: "User Management", href: "/admin/users", roles: ["ADMIN"] },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = allNavItems.filter(item => user && item.roles.includes(user.role));

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "var(--afrocat-bg)", color: "var(--afrocat-text)" }}>
      <div className="md:hidden flex items-center justify-between p-4 border-b border-ac-border" style={{ background: "var(--afrocat-card)" }}>
        <div className="flex items-center gap-2">
          <img src={logo} alt="Afrocat Logo" className="w-8 h-8 object-contain" />
          <span className="font-display font-bold text-ac-text">Afrocat Portal</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} data-testid="button-mobile-menu" className="text-ac-text">
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <aside
        className={`${mobileOpen ? 'block' : 'hidden'} md:block w-full md:w-64 border-r border-ac-border flex flex-col`}
        style={{ background: "var(--afrocat-card)" }}
      >
        <div className="hidden md:flex p-6 items-center gap-3 border-b border-ac-border">
          <img src={logo} alt="Afrocat Logo" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="font-display font-bold text-lg leading-tight tracking-tight text-ac-text">
              Afrocat Portal
            </h1>
            <p className="text-xs text-ac-muted font-medium">Club Management</p>
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
                      ? "bg-ac-teal/15 text-ac-teal" 
                      : "text-ac-muted hover:bg-ac-white-5 hover:text-ac-text"
                  }`}
                >
                  <item.icon size={18} className={isActive ? "text-ac-teal" : "text-ac-muted"} />
                  {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-ac-border">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-ac-teal-soft flex items-center justify-center border border-ac-teal/20">
              <ShieldAlert size={16} className="text-ac-teal" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ac-text">{user?.fullName}</p>
              <p className="text-xs text-ac-muted">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            data-testid="nav-link-logout"
            className="flex items-center gap-3 px-4 py-2 w-full text-sm font-medium text-ac-red hover:bg-ac-red-soft rounded-md transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto afrocat-page">
        <div className="p-6 md:p-10 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
