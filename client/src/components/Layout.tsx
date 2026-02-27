import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, Users, Trophy, ClipboardList, 
  CalendarCheck, DollarSign, Activity, FileText, 
  LogOut, ShieldAlert
} from "lucide-react";
import { mockUser } from "@/lib/mock-data";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: Users, label: "Teams", href: "/teams" },
    { icon: Users, label: "Players", href: "/players" },
    { icon: Trophy, label: "Matches", href: "/matches" },
    { icon: ClipboardList, label: "Enter Stats", href: "/stats" },
    { icon: CalendarCheck, label: "Attendance", href: "/attendance" },
    { icon: DollarSign, label: "Finance", href: "/finance" },
    { icon: Activity, label: "Injuries", href: "/injuries" },
    { icon: FileText, label: "Reports", href: "/reports" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-sidebar-border">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-display font-bold text-xl">
            AC
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight tracking-tight text-sidebar-foreground">
              Afrocat Portal
            </h1>
            <p className="text-xs text-sidebar-foreground/60 font-medium">Club Management</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <a
                  data-testid={`nav-link-${item.label.toLowerCase().replace(' ', '-')}`}
                  className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors text-sm font-medium ${
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  }`}
                >
                  <item.icon size={18} className={isActive ? "text-primary" : "text-sidebar-foreground/50"} />
                  {item.label}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
              <ShieldAlert size={16} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">{mockUser.fullName}</p>
              <p className="text-xs text-muted-foreground">{mockUser.role}</p>
            </div>
          </div>
          <Link href="/">
            <a data-testid="nav-link-logout" className="flex items-center gap-3 px-4 py-2 w-full text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors">
              <LogOut size={18} />
              Sign Out
            </a>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background/50">
        <div className="p-6 md:p-10 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}