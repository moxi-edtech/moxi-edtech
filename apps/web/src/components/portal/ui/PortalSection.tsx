import type { ReactNode } from "react";

/** Portal section hierarchy shared by aluno, professor and secretaria. */
export function PortalSection({
  id,
  title,
  action,
  children,
  className = "",
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={`min-w-0 space-y-2 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
