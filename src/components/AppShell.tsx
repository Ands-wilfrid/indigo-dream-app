import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  ListChecks,
  LogOut,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Array<"admin" | "manager" | "member">;
}

const nav: NavItem[] = [
  { to: "/app", label: "Tableau de bord", icon: LayoutDashboard, roles: ["admin", "manager", "member"] },
  { to: "/app/projects", label: "Projets", icon: FolderKanban, roles: ["admin", "manager", "member"] },
  { to: "/app/my-tasks", label: "Mes tâches", icon: ListChecks, roles: ["admin", "manager", "member"] },
  { to: "/app/users", label: "Utilisateurs", icon: Users, roles: ["admin"] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const items = nav.filter((n) => (role ? n.roles.includes(role) : false));

  const SidebarContent = (
    <div className="flex h-full flex-col p-4">
      <Link to="/app" className="flex items-center gap-2 px-2 py-4 mb-4">
        <div className="relative">
          <div className="absolute inset-0 blur-md bg-primary/60 rounded-lg" />
          <div className="relative bg-gradient-to-br from-primary to-accent rounded-lg p-1.5">
            <Sparkles className="size-5 text-primary-foreground" />
          </div>
        </div>
        <span className="font-display text-lg font-bold gradient-text">Pulse</span>
      </Link>

      <nav className="flex-1 space-y-1">
        {items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-gradient-to-r from-primary/20 to-accent/10 text-foreground border border-primary/30 shadow-[0_0_20px_oklch(0.65_0.22_270_/_0.2)]"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
            >
              <item.icon className="size-4" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="glass rounded-xl p-3 mt-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="size-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-semibold text-primary-foreground text-sm">
            {user?.email?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{role === "manager" ? "Responsable" : role === "admin" ? "Admin" : "Membre"}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleLogout}>
          <LogOut className="size-4" /> Déconnexion
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-border/50 bg-sidebar/60 backdrop-blur-xl">
        {SidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-72 z-50 glass-strong lg:hidden animate-fade-in">
            {SidebarContent}
          </aside>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-30 glass-strong border-b border-border/50 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-white/5"
            aria-label="Menu"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <span className="font-display font-bold gradient-text">Pulse</span>
          <div className="size-9" />
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
