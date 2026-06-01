import { createFileRoute, useParams, Link } from "@tanstack/react-router";
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
import { ArrowLeft, Plus, ListChecks, GripVertical, Wifi, WifiOff, CloudUpload } from "lucide-react";
import {
  cacheGet,
  cacheSet,
  enqueue,
  useFlushQueue,
  useOnlineStatus,
  useQueueSize,
  type QueuedMutation,
} from "@/lib/offline-queue";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { taskSchema, type TaskInput } from "@/lib/schemas";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCorners, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";

export const Route = createFileRoute("/app/projects/$projectId")({
  head: () => ({ meta: [{ title: "Projet · Pulse" }] }),
  component: ProjectDetail,
});

type TaskStatus = "todo" | "in_progress" | "done";
const COLS: { id: TaskStatus; label: string; color: string }[] = [
  { id: "todo", label: "À faire", color: "from-muted-foreground/20 to-transparent" },
  { id: "in_progress", label: "En cours", color: "from-warning/20 to-transparent" },
  { id: "done", label: "Terminé", color: "from-success/20 to-transparent" },
];

function ProjectDetail() {
  const { projectId } = useParams({ from: "/app/projects/$projectId" });
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const canManage = role === "admin" || role === "manager";
  const online = useOnlineStatus();
  const queueSize = useQueueSize();

  const projectCacheKey = `project:${projectId}`;
  const tasksCacheKey = `tasks:${projectId}`;

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    initialData: () => cacheGet<any>(projectCacheKey) ?? undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects").select("*, manager:profiles!projects_manager_id_fkey(full_name, email)")
        .eq("id", projectId).single();
      if (error) throw error;
      cacheSet(projectCacheKey, data);
      return data;
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["tasks", projectId],
    initialData: () => cacheGet<any[]>(tasksCacheKey) ?? undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks").select("*, assignee:profiles!tasks_assignee_id_fkey(full_name, email)")
        .eq("project_id", projectId).order("position", { ascending: true });
      if (error) throw error;
      const rows = data ?? [];
      cacheSet(tasksCacheKey, rows);
      return rows;
    },
  });

  // Persist every cache update (including optimistic mutations) so the board
  // is fully usable on a cold reload while offline.
  useEffect(() => {
    if (tasks) cacheSet(tasksCacheKey, tasks);
  }, [tasks, tasksCacheKey]);

  const moveTask = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["tasks", projectId] });
      const prev = qc.getQueryData<any[]>(["tasks", projectId]);
      qc.setQueryData<any[]>(["tasks", projectId], (old) =>
        old?.map((t) => (t.id === id ? { ...t, status } : t)) ?? [],
      );
      return { prev };
    },
    onError: (_e, vars, ctx) => {
      // If we're offline, keep the optimistic state and queue the change.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueue({ type: "move-task", payload: { taskId: vars.id, status: vars.status } });
        toast.message("Hors ligne", { description: "La modification sera synchronisée au retour en ligne." });
        return;
      }
      if (ctx?.prev) qc.setQueryData(["tasks", projectId], ctx.prev);
      toast.error("Synchronisation échouée");
    },
    onSettled: () => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      }
    },
  });

  // Replay queued mutations whenever we come back online.
  useFlushQueue(async (m: QueuedMutation) => {
    if (m.type === "move-task") {
      const { error } = await supabase
        .from("tasks")
        .update({ status: m.payload.status })
        .eq("id", m.payload.taskId);
      if (error) throw error;
    }
  }, [projectId]);

  // Refresh from server when connectivity is restored.
  useEffect(() => {
    if (online) qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const grouped = useMemo(() => {
    const g: Record<TaskStatus, any[]> = { todo: [], in_progress: [], done: [] };
    tasks?.forEach((t) => g[t.status as TaskStatus]?.push(t));
    return g;
  }, [tasks]);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const taskId = String(e.active.id);
    const overId = e.over?.id;
    if (!overId) return;
    const newStatus = String(overId).startsWith("col-") ? (String(overId).slice(4) as TaskStatus) : null;
    if (!newStatus) return;
    const task = tasks?.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    if (!canManage && task.assignee_id !== user?.id) {
      toast.error("Vous ne pouvez déplacer que vos propres tâches");
      return;
    }
    moveTask.mutate({ id: taskId, status: newStatus });
  };

  const activeTask = tasks?.find((t) => t.id === activeId);

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/app/projects" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Tous les projets
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">{project?.name ?? "…"}</h1>
          {project?.description && <p className="text-muted-foreground mt-2 max-w-2xl">{project.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <SyncBadge online={online} queueSize={queueSize} />
          {canManage && project && <CreateTaskDialog projectId={projectId} userId={user!.id} />}
        </div>
      </div>

      {tasks && tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Aucune tâche"
          description={canManage ? "Ajoutez la première tâche du projet." : "Aucune tâche ne vous a été assignée."}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
          onDragEnd={handleDragEnd}
        >
          <div className="grid md:grid-cols-3 gap-4">
            {COLS.map((col) => (
              <Column key={col.id} id={col.id} label={col.label} color={col.color} tasks={grouped[col.id]} />
            ))}
          </div>
          <DragOverlay>
            {activeTask && <TaskCard task={activeTask} dragging />}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

function SyncBadge({ online, queueSize }: { online: boolean; queueSize: number }) {
  if (!online) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 text-warning px-3 py-1.5 text-xs font-medium border border-warning/30">
        <WifiOff className="size-3.5" />
        Hors ligne{queueSize > 0 ? ` · ${queueSize} en attente` : ""}
      </span>
    );
  }
  if (queueSize > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 text-primary px-3 py-1.5 text-xs font-medium border border-primary/30 animate-pulse">
        <CloudUpload className="size-3.5" />
        Synchronisation… {queueSize}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 text-success px-3 py-1.5 text-xs font-medium border border-success/30">
      <Wifi className="size-3.5" />
      Synchronisé
    </span>
  );
}

function Column({ id, label, color, tasks }: { id: TaskStatus; label: string; color: string; tasks: any[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${id}` });
  return (
    <div
      ref={setNodeRef}
      className={`glass rounded-2xl p-4 min-h-[400px] bg-gradient-to-b ${color} transition-all ${isOver ? "border-primary/50 ring-2 ring-primary/30" : ""}`}
    >
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="font-display font-semibold">{label}</h3>
        <span className="text-xs text-muted-foreground bg-white/5 rounded-full px-2 py-0.5">{tasks.length}</span>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => <TaskCard key={t.id} task={t} />)}
      </div>
    </div>
  );
}

function TaskCard({ task, dragging }: { task: any; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`glass-strong rounded-xl p-3 cursor-grab active:cursor-grabbing group ${isDragging ? "opacity-30" : ""} ${dragging ? "rotate-2 shadow-[var(--shadow-elevated)]" : ""}`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="size-4 text-muted-foreground/50 mt-0.5 opacity-0 group-hover:opacity-100 transition" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium mb-2">{task.title}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityBadge p={task.priority} />
            {task.assignee && (
              <span className="text-xs text-muted-foreground truncate">
                {(task.assignee as any).full_name || (task.assignee as any).email}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
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

function CreateTaskDialog({ projectId, userId }: { projectId: string; userId: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: members } = useQuery({
    queryKey: ["all-members"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      return data ?? [];
    },
    enabled: open,
  });

  const form = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", description: "", priority: "medium", status: "todo", assignee_id: null, due_date: null },
  });

  const mutation = useMutation({
    mutationFn: async (values: TaskInput) => {
      const { error } = await supabase.from("tasks").insert({
        project_id: projectId,
        title: values.title,
        description: values.description || null,
        priority: values.priority,
        status: values.status,
        assignee_id: values.assignee_id || null,
        due_date: values.due_date || null,
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tâche créée");
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      form.reset();
      setOpen(false);
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 glow-primary">
          <Plus className="size-4" /> Nouvelle tâche
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-strong border-border max-w-lg">
        <DialogHeader><DialogTitle className="font-display">Nouvelle tâche</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          <div>
            <Label htmlFor="title">Titre *</Label>
            <Input id="title" {...form.register("title")} className="mt-1.5" />
            {form.formState.errors.title && <p className="text-xs text-destructive mt-1">{form.formState.errors.title.message}</p>}
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} {...form.register("description")} className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priorité</Label>
              <Select defaultValue="medium" onValueChange={(v) => form.setValue("priority", v as any)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent className="glass-strong">
                  <SelectItem value="low">Bas</SelectItem>
                  <SelectItem value="medium">Moyen</SelectItem>
                  <SelectItem value="high">Élevé</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assigner à</Label>
              <Select onValueChange={(v) => form.setValue("assignee_id", v === "none" ? null : v)}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Personne" /></SelectTrigger>
                <SelectContent className="glass-strong">
                  <SelectItem value="none">Personne</SelectItem>
                  {members?.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="due_date">Échéance</Label>
            <Input id="due_date" type="date" {...form.register("due_date")} className="mt-1.5" />
          </div>
          <Button type="submit" disabled={mutation.isPending} className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground">
            {mutation.isPending ? "Création…" : "Créer la tâche"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
