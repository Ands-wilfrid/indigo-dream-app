import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/lib/auth-context";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass rounded-2xl p-10 max-w-md text-center animate-fade-in">
        <h1 className="text-6xl font-display font-bold gradient-text mb-2">404</h1>
        <h2 className="font-display text-xl mb-2">Page introuvable</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass rounded-2xl p-8 max-w-md text-center">
        <h1 className="font-display text-xl mb-2">Une erreur est survenue</h1>
        <p className="text-sm text-muted-foreground mb-6 break-words">{error.message}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Réessayer
          </button>
          <a href="/" className="rounded-xl border border-border px-5 py-2.5 text-sm hover:bg-white/5">
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Pulse — Gestion de projets" },
      { name: "description", content: "Plateforme de gestion de projets et tâches pour équipes performantes." },
      { name: "theme-color", content: "#1a1530" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            className: "glass-strong",
            style: { background: "oklch(0.18 0.03 270 / 0.85)", border: "1px solid oklch(1 0 0 / 0.1)", color: "oklch(0.97 0.01 250)" },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
