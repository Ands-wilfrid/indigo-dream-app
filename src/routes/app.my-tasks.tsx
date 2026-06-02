import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { GlassCard } from "@/components/GlassCard";
import { EmptyState } from "@/components/EmptyState";
import { ListChecks, Calendar } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/app/my-tasks")({
  validateSearch: (search) => {
    const allowed = ["todo", "in_progress", "done"];
    return { status: typeof search.status === "string" && allowed.includes(search.status) ? search.status : undefined };
  },
  head: () => ({ meta: [{ title: "Mes tâches · Pulse" }] }),
  component: MyTasks,
});

function MyTasks() {
  const { user } = useAuth();
  const { status } = Route.useSearch();
  const qc = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["my-tasks", user?.id, status],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("*, projects(id, name)")
        .eq("assignee_id", user!.id);

      if (status) query = query.eq("status", status);

      const { data, error } = await query.order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: any }) => {
      const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mise à jour");
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold">Mes tâches</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {status === "in_progress" ? "Vos tâches en cours." : status === "done" ? "Vos tâches terminées." : "Toutes les tâches qui vous sont assignées."}
        </p>
      </div>

      {isLoading ? (
        <GlassCard className="p-6 h-40 animate-pulse" />
      ) : tasks && tasks.length > 0 ? (
        <div className="space-y-2">
          {tasks.map((t) => (
            <GlassCard key={t.id} className="p-4 flex items-center gap-4 hover:border-primary/30 transition">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{t.title}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <Link to="/app/projects/$projectId" params={{ projectId: t.project_id }} className="hover:text-primary">
                    {(t.projects as any)?.name}
                  </Link>
                  {t.due_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {format(new Date(t.due_date), "d MMM", { locale: fr })}
                    </span>
                  )}
                </div>
              </div>
              <Select value={t.status} onValueChange={(v) => updateStatus.mutate({ id: t.id, status: v })}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent className="glass-strong">
                  <SelectItem value="todo">À faire</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="done">Terminé</SelectItem>
                </SelectContent>
              </Select>
            </GlassCard>
          ))}
        </div>
      ) : (
        <EmptyState icon={ListChecks} title="Aucune tâche assignée" description="Vos responsables vous assigneront bientôt des tâches." />
      )}
    </div>
  );
}
