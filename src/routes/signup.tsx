import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, type SignUpInput } from "@/lib/schemas";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Créer un compte · Pulse" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate({ to: "/app" });
  }, [user, navigate]);

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  const onSubmit = async (values: SignUpInput) => {
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { full_name: values.fullName },
      },
    });
    if (error) {
      toast.error("Inscription impossible", { description: error.message });
      return;
    }
    // Auto-confirm is enabled — sign the user in immediately.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (signInError) {
      toast.success("Compte créé !", { description: "Connectez-vous." });
      navigate({ to: "/login" });
      return;
    }
    toast.success("Bienvenue !");
    navigate({ to: "/app" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-scale-in">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="bg-gradient-to-br from-primary to-accent rounded-lg p-1.5">
            <Sparkles className="size-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold">Pulse</span>
        </Link>

        <div className="glass-strong rounded-2xl p-8 shadow-[var(--shadow-elevated)]">
          <h1 className="font-display text-2xl mb-1">Créer un compte</h1>
          <p className="text-sm text-muted-foreground mb-6">Démarrez en moins d'une minute.</p>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Nom complet</Label>
              <Input id="fullName" {...form.register("fullName")} className="mt-1.5" />
              {form.formState.errors.fullName && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.fullName.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...form.register("email")} className="mt-1.5" />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} className="mt-1.5" />
              {form.formState.errors.password && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 glow-primary"
            >
              {form.formState.isSubmitting ? "Création…" : "Créer mon compte"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Déjà inscrit ?{" "}
            <Link to="/login" className="text-primary hover:underline">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
