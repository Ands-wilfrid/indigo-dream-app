import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { GlassCard } from "@/components/GlassCard";
import { EmptyState } from "@/components/EmptyState";
import { Users, ShieldOff } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/app/users")({
  head: () => ({ meta: [{ title: "Utilisateurs · Pulse" }] }),
  component: UsersPage,
});

function UsersPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (role && role !== "admin") navigate({ to: "/app" });
  }, [role, navigate]);

  const { data: users } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("*"),
      ]);
      const profiles = profilesRes.data ?? [];
      const roles = rolesRes.data ?? [];
      const order = ["admin", "manager", "member"];
      return profiles.map((p) => {
        const userRoles = roles.filter((r) => r.user_id === p.id).map((r) => r.role);
        const best = order.find((o) => userRoles.includes(o as any)) ?? "member";
        return { ...p, role: best };
      });
    },
    enabled: role === "admin",
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rôle mis à jour");
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  if (role !== "admin") {
    return <EmptyState icon={ShieldOff} title="Accès refusé" description="Cette page est réservée aux administrateurs." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-bold">Utilisateurs</h1>
        <p className="text-sm text-muted-foreground mt-1">Gérez les rôles de votre équipe.</p>
      </div>

      {users && users.length > 0 ? (
        <div className="space-y-2">
          {users.map((u) => (
            <GlassCard key={u.id} className="p-4 flex items-center gap-4">
              <div className="size-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-semibold text-primary-foreground">
                {(u.full_name || u.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{u.full_name || u.email}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <Select value={u.role} onValueChange={(v) => setRole.mutate({ userId: u.id, newRole: v })}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent className="glass-strong">
                  <SelectItem value="admin">Administrateur</SelectItem>
                  <SelectItem value="manager">Responsable</SelectItem>
                  <SelectItem value="member">Membre</SelectItem>
                </SelectContent>
              </Select>
            </GlassCard>
          ))}
        </div>
      ) : (
        <EmptyState icon={Users} title="Aucun utilisateur" description="Invitez votre équipe à rejoindre Pulse." />
      )}
    </div>
  );
}
