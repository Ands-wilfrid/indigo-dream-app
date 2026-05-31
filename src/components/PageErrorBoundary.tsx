import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="glass rounded-2xl p-8 max-w-md text-center">
        <AlertTriangle className="size-10 text-destructive mx-auto mb-4" />
        <h2 className="font-display text-xl mb-2">Une erreur est survenue</h2>
        <p className="text-sm text-muted-foreground mb-6 break-words">{error.message}</p>
        <Button onClick={reset}>Réessayer</Button>
      </div>
    </div>
  );
}
