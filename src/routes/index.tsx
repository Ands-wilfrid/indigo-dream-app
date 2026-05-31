import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles, FolderKanban, Users, Zap, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pulse — Pilotez vos projets avec clarté" },
      { name: "description", content: "Une plateforme de gestion de projets premium pour équipes ambitieuses. Kanban, rôles, et collaboration en temps réel." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Top nav */}
      <header className="relative z-10 mx-auto max-w-7xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-primary to-accent rounded-lg p-1.5">
            <Sparkles className="size-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold">Pulse</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm hover:text-primary transition">Connexion</Link>
          <Link
            to="/signup"
            className="rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
          >
            Commencer
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs mb-8 animate-fade-in">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          Nouveau · Collaboration multi-rôles
        </div>
        <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-6 animate-slide-up">
          Pilotez vos projets <br />
          <span className="gradient-text">avec une clarté absolue.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up">
          Pulse réunit administrateurs, responsables et membres autour d'un Kanban fluide,
          une attribution intelligente et un suivi temps réel. Pensé pour les équipes qui livrent.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 animate-slide-up">
          <Button asChild size="lg" className="rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 glow-primary">
            <Link to="/signup">
              Démarrer gratuitement <ArrowRight className="size-4 ml-1" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-xl border-border">
            <Link to="/login">J'ai déjà un compte</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24 grid md:grid-cols-3 gap-6">
        {[
          { icon: FolderKanban, title: "Kanban temps réel", desc: "Drag-and-drop fluide, mise à jour optimiste hors ligne." },
          { icon: Users, title: "Rôles & permissions", desc: "Admin, responsable, membre. Chacun voit ce qu'il doit voir." },
          { icon: ShieldCheck, title: "Sécurité native", desc: "Row Level Security sur chaque table, par défaut." },
        ].map((f) => (
          <div key={f.title} className="glass rounded-2xl p-6 hover:border-primary/30 transition-all hover:-translate-y-1 duration-300">
            <div className="bg-gradient-to-br from-primary/20 to-accent/10 rounded-xl p-3 w-fit mb-4">
              <f.icon className="size-5 text-primary" />
            </div>
            <h3 className="font-display text-lg font-semibold mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="relative z-10 border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        © 2026 Pulse · Conçu pour les équipes qui livrent.
      </footer>
    </div>
  );
}
