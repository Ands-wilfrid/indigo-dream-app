import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { GlassCard } from "@/components/GlassCard";
import { FolderKanban, ListChecks, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Tableau de bord · Pulse" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, role } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    queryFn: async () => {
      const [projects, myTasks, doneTasks, inProgressTasks] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("assignee_id", user!.id),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("assignee_id", user!.id).eq("status", "done"),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("assignee_id", user!.id).eq("status", "in_progress"),
      ]);
      return {
        projects: projects.count ?? 0,
        myTasks: myTasks.count ?? 0,
        done: doneTasks.count ?? 0,
        inProgress: inProgressTasks.count ?? 0,
      };
    },
    enabled: !!user,
  });

  const { data: recentTasks } = useQuery({
    queryKey: ["recent-tasks", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, status, priority, project_id, projects(name)")
        .eq("assignee_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!user,
  });

  const completion = stats && stats.myTasks > 0 ? Math.round((stats.done / stats.myTasks) * 100) : 0;

  const greeting = role === "admin" ? "Administrateur" : role === "manager" ? "Responsable" : "Membre";

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <p className="text-sm text-muted-foreground">Espace {greeting}</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold mt-1">
          Bonjour, <span className="gradient-text">{user?.email?.split("@")[0]}</span>
        </h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FolderKanban} label="Projets" value={stats?.projects ?? 0} accent="primary" />
        <StatCard icon={ListChecks} label="Mes tâches" value={stats?.myTasks ?? 0} accent="accent" />
        <StatCard icon={Clock} label="En cours" value={stats?.inProgress ?? 0} accent="warning" />
        <StatCard icon={CheckCircle2} label="Terminées" value={stats?.done ?? 0} accent="success" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl">Tâches récentes</h2>
            <Link to="/app/my-tasks" className="text-xs text-primary hover:underline">Voir tout</Link>
          </div>
          {recentTasks && recentTasks.length > 0 ? (
            <div className="space-y-2">
              {recentTasks.map((t) => (
                <Link
                  key={t.id}
                  to="/app/projects/$projectId"
                  params={{ projectId: t.project_id }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition group"
                >
                  <StatusDot status={t.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{(t.projects as any)?.name}</p>
                  </div>
                  <PriorityBadge p={t.priority} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={ListChecks} title="Aucune tâche pour l'instant" description="Vos tâches récentes apparaîtront ici." />
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="size-4 text-accent" />
            <h2 className="font-display text-xl">Progression</h2>
          </div>
          <div className="text-center py-6">
            <div className="relative inline-flex">
              <svg className="size-32" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="oklch(1 0 0 / 0.06)" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="url(#g)"
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(completion / 100) * 263.9} 263.9`}
                  transform="rotate(-90 50 50)"
                />
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="oklch(0.65 0.22 270)" />
                    <stop offset="100%" stopColor="oklch(0.75 0.16 210)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-3xl font-bold">{completion}%</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              {stats?.done ?? 0} / {stats?.myTasks ?? 0} tâches accomplies
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent: string }) {
  const colors: Record<string, string> = {
    primary: "from-primary/20 to-primary/5 text-primary",
    accent: "from-accent/20 to-accent/5 text-accent",
    warning: "from-warning/20 to-warning/5 text-warning",
    success: "from-success/20 to-success/5 text-success",
  };
  return (
    <GlassCard className="p-5 hover:-translate-y-0.5 transition-transform">
      <div className={`bg-gradient-to-br ${colors[accent]} rounded-xl p-2.5 w-fit mb-3`}>
        <Icon className="size-4" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl md:text-3xl font-bold mt-1">{value}</p>
    </GlassCard>
  );
}

function StatusDot({ status }: { status: string }) {
  const c = status === "done" ? "bg-success" : status === "in_progress" ? "bg-warning" : "bg-muted-foreground";
  return <div className={`size-2 rounded-full ${c}`} />;
}

function PriorityBadge({ p }: { p: string }) {
  const map: Record<string, string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-primary/15 text-primary",
    high: "bg-warning/15 text-warning",
    urgent: "bg-destructive/15 text-destructive",
  };
  const label: Record<string, string> = { low: "Bas", medium: "Moyen", high: "Élevé", urgent: "Urgent" };
  return <span className={`text-xs px-2 py-0.5 rounded-md ${map[p]}`}>{label[p]}</span>;
}
