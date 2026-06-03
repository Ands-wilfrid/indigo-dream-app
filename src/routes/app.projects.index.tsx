import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { GlassCard } from "@/components/GlassCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { FolderKanban, Plus, Calendar, User as UserIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema, type ProjectInput } from "@/lib/schemas";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export const Route = createFileRoute("/app/projects/")({
  head: () => ({ meta: [{ title: "Projets · Pulse" }] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { role, user } = useAuth();
  const canCreate = role === "admin" || role === "manager";

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data: projectRows, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = projectRows ?? [];
      const managerIds = [...new Set(rows.map((p) => p.manager_id).filter(Boolean))] as string[];

      if (managerIds.length === 0) return rows.map((p) => ({ ...p, manager: null }));

      const { data: managers } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", managerIds);

      const managersById = new Map((managers ?? []).map((m) => [m.id, m]));
      return rows.map((p) => ({ ...p, manager: p.manager_id ? managersById.get(p.manager_id) ?? null : null }));
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Projets</h1>
          <p className="text-sm text-muted-foreground mt-1">Tous les projets accessibles depuis votre rôle.</p>
        </div>
        {canCreate && <CreateProjectDialog userId={user!.id} />}
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <GlassCard key={i} className="p-6 h-40 animate-pulse" />)}
        </div>
      ) : projects && projects.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              to="/app/projects/$projectId"
              params={{ projectId: p.id }}
              className="block group"
            >
              <GlassCard className="p-6 h-full hover:-translate-y-1 hover:border-primary/40 transition-all duration-300">
                <div className="flex items-start justify-between mb-3">
                  <div className="bg-gradient-to-br from-primary/20 to-accent/10 rounded-xl p-2.5">
                    <FolderKanban className="size-5 text-primary" />
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <h3 className="font-display text-lg font-semibold mb-1 group-hover:text-primary transition">{p.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 min-h-[2.5rem]">
                  {p.description || "Aucune description"}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/50">
                  <div className="flex items-center gap-1">
                    <UserIcon className="size-3" />
                    {(p.manager as any)?.full_name || "Sans responsable"}
                  </div>
                  {p.due_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {format(new Date(p.due_date), "d MMM", { locale: fr })}
                    </div>
                  )}
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderKanban}
          title="Aucun projet"
          description={canCreate ? "Créez votre premier projet pour démarrer." : "Vous n'avez accès à aucun projet pour le moment."}
          action={canCreate ? <CreateProjectDialog userId={user!.id} /> : undefined}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { c: string; l: string }> = {
    active: { c: "bg-success/15 text-success", l: "Actif" },
    on_hold: { c: "bg-warning/15 text-warning", l: "En pause" },
    completed: { c: "bg-primary/15 text-primary", l: "Terminé" },
    archived: { c: "bg-muted text-muted-foreground", l: "Archivé" },
  };
  const s = map[status] ?? map.active;
  return <span className={`text-xs px-2.5 py-1 rounded-md ${s.c}`}>{s.l}</span>;
}

function CreateProjectDialog({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const qc = useQueryClient();

  const { data: people } = useQuery({
    queryKey: ["all-people"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return data ?? [];
    },
    enabled: open,
  });

  const form = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", description: "", status: "active", manager_id: null, due_date: null },
  });

  const managerId = form.watch("manager_id");

  const mutation = useMutation({
    mutationFn: async (values: ProjectInput) => {
      const { data: created, error } = await supabase
        .from("projects")
        .insert({
          name: values.name,
          description: values.description || null,
          status: values.status,
          manager_id: values.manager_id || null,
          due_date: values.due_date || null,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Add selected members (exclude the manager, who already has access)
      const memberIds = [...selectedMembers].filter((id) => id !== values.manager_id);
      if (created && memberIds.length > 0) {
        const rows = memberIds.map((uid) => ({ project_id: created.id, user_id: uid }));
        const { error: mErr } = await supabase.from("project_members").insert(rows);
        if (mErr) throw mErr;
      }
    },
    onSuccess: () => {
      toast.success("Projet créé");
      qc.invalidateQueries({ queryKey: ["projects"] });
      form.reset();
      setSelectedMembers(new Set());
      setOpen(false);
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 glow-primary">
          <Plus className="size-4" /> Nouveau projet
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-strong border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Nouveau projet</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div>
            <Label htmlFor="name">Nom *</Label>
            <Input id="name" {...form.register("name")} className="mt-1.5" />
            {form.formState.errors.name && <p className="text-xs text-destructive mt-1">{form.formState.errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} {...form.register("description")} className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Responsable</Label>
              <Select onValueChange={(v) => form.setValue("manager_id", v === "none" ? null : v)}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent className="glass-strong">
                  <SelectItem value="none">Aucun</SelectItem>
                  {people?.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="due_date">Échéance</Label>
              <Input id="due_date" type="date" {...form.register("due_date")} className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label>Membres participants</Label>
            <p className="text-xs text-muted-foreground mb-2 mt-1">Sélectionnez les personnes qui participeront au projet.</p>
            <div className="rounded-lg border border-border max-h-48 overflow-y-auto divide-y divide-border/50">
              {people && people.length > 0 ? (
                people
                  .filter((p) => p.id !== managerId)
                  .map((p) => (
                    <label key={p.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30">
                      <Checkbox
                        checked={selectedMembers.has(p.id)}
                        onCheckedChange={() => toggleMember(p.id)}
                      />
                      <span className="text-sm">{p.full_name || p.email}</span>
                    </label>
                  ))
              ) : (
                <p className="text-xs text-muted-foreground p-3">Chargement…</p>
              )}
            </div>
          </div>
          <Button type="submit" disabled={mutation.isPending} className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground">
            {mutation.isPending ? "Création…" : "Créer le projet"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
