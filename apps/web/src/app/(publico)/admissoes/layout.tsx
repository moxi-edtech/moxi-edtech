// apps/web/src/app/(publico)/admissoes/layout.tsx
import { ReactNode } from "react";

export default function PublicoAdmissoesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-slate-50 font-sans text-slate-900 antialiased">
      {children}
    </div>
  );
}
