import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function SecaoLabel({ children, className }: { children: ReactNode, className?: string }) {
  return (
    <h2 className={cn("text-[10px] font-bold uppercase tracking-widest text-muted-foreground", className)}>
      {children}
    </h2>
  );
}
