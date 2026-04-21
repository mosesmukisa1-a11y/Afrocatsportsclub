import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Trophy,
  ClipboardList,
  MessageCircle,
  Image,
  MoreHorizontal,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const tabs = [
  { icon: LayoutDashboard, label: "Home", href: "/dashboard", roles: ["ADMIN","MANAGER","COACH","CAPTAIN","STATISTICIAN","FINANCE","MEDICAL","PLAYER"] },
  { icon: Trophy, label: "Matches", href: "/matches", roles: ["ADMIN","MANAGER","COACH","STATISTICIAN"] },
  { icon: ClipboardList, label: "Stats", href: "/stats", roles: ["ADMIN","MANAGER","COACH","STATISTICIAN"] },
  { icon: MessageCircle, label: "Chat", href: "/chat", roles: ["ADMIN","MANAGER","COACH","CAPTAIN","STATISTICIAN","PLAYER"] },
  { icon: Image, label: "Media", href: "/media-gallery", roles: ["ADMIN","MANAGER","COACH","CAPTAIN","STATISTICIAN","FINANCE","MEDICAL","PLAYER"] },
];

interface MobileNavProps {
  onMorePress: () => void;
}

export function MobileNav({ onMorePress }: MobileNavProps) {
  const [location] = useLocation();
  const { user, activeRole } = useAuth();
  const effectiveRole = activeRole || user?.role || "";
  const isSuperAdmin = user?.isSuperAdmin === true;
  const visibleTabs = tabs.filter(t => isSuperAdmin || t.roles.includes(effectiveRole));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-afrocat-card border-t border-afrocat-border md:hidden"
      data-testid="mobile-bottom-nav"
      data-no-print
    >
      <div className="flex items-center justify-around">
        {visibleTabs.map((tab) => {
          const isActive = location === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center flex-1 h-14 text-[10px] font-medium transition-colors ${
                isActive ? "text-afrocat-teal" : "text-afrocat-muted"
              }`}
              data-testid={`mobile-tab-${tab.label.toLowerCase()}`}
            >
              <tab.icon size={20} />
              <span className="mt-0.5">{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={onMorePress}
          className="flex flex-col items-center justify-center flex-1 h-14 text-[10px] font-medium text-afrocat-muted transition-colors"
          data-testid="mobile-tab-more"
        >
          <MoreHorizontal size={20} />
          <span className="mt-0.5">More</span>
        </button>
      </div>
    </nav>
  );
}
