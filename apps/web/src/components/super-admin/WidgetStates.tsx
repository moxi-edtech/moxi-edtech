import { AlertTriangle, Check, LayoutDashboard } from "lucide-react";

export function WidgetSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-busy="true" aria-live="polite">
      <div className="mb-3 h-4 w-32 animate-pulse rounded-full bg-border" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className="h-3 animate-pulse rounded-full bg-border" />
        ))}
      </div>
    </div>
  );
}

export function WidgetEmpty({ title, message, nextStep }: { title: string; message: string; nextStep: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center shadow-sm">
      <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm text-foreground/80">
        <LayoutDashboard className="h-4 w-4" />
        {title}
      </div>
      <p className="text-sm text-foreground/80">{message}</p>
      <p className="mt-1 text-sm font-medium text-muted-foreground">Próximo passo: {nextStep}</p>
    </div>
  );
}

export function WidgetError({ title, message, nextStep }: { title: string; message: string; nextStep: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm" role="alert">
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-red-700">
        <AlertTriangle className="h-4 w-4" />
        {title}
      </p>
      <p className="mt-1 text-sm text-red-700">{message}</p>
      <p className="mt-1 inline-flex items-center gap-2 text-sm text-red-600">
        <Check className="h-4 w-4" />
        Próximo passo: {nextStep}
      </p>
    </div>
  );
}
