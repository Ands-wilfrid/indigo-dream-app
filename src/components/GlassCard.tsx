import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "glass rounded-2xl shadow-[var(--shadow-glass)] transition-all duration-300",
        className,
      )}
      {...props}
    />
  );
}
