import { PORTAL_PAGE_INSET } from "@/lib/layout/portal-page";
import { OperationalMetricSkeleton } from "@/components/shared/OperationalMetricCard";

export default function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="A carregar painel da Secretaria"
      className={`${PORTAL_PAGE_INSET} operations-dashboard-flow pb-16`}
      style={{ containerType: "inline-size" }}
    >
      <span className="sr-only">A carregar painel da Secretaria</span>
      <div aria-hidden="true" className="space-y-2 motion-safe:animate-pulse">
        <div className="h-7 lg:h-8 w-40 rounded-xl bg-muted" />
        <div className="h-4 w-56 max-w-full rounded-xl bg-muted" />
      </div>
      <div
        aria-hidden="true"
        className="h-20 rounded-xl border border-border bg-card motion-safe:animate-pulse"
      />
      <div className="space-y-4">
        <div
          aria-hidden="true"
          className="h-5 w-36 rounded-xl bg-muted motion-safe:animate-pulse"
        />
        <div className="grid min-w-0 gap-4 @min-[520px]:grid-cols-2">
          {[0, 1].map((key) => (
            <OperationalMetricSkeleton key={key} />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div
          aria-hidden="true"
          className="h-5 w-48 rounded-xl bg-muted motion-safe:animate-pulse"
        />
        <div className="operations-daily-grid grid">
          {[0, 1, 2].map((key) => (
            <OperationalMetricSkeleton key={key} />
          ))}
        </div>
      </div>
      <div
        aria-hidden="true"
        className="h-56 @min-[920px]:h-36 rounded-xl border border-border bg-card motion-safe:animate-pulse"
      />
      <div className="space-y-4">
        <div
          aria-hidden="true"
          className="h-5 w-32 rounded-xl bg-muted motion-safe:animate-pulse"
        />
        <div className="operations-actions-grid grid">
          {Array.from({ length: 8 }, (_, key) => (
            <div
              key={key}
              aria-hidden="true"
              className="min-h-[88px] rounded-xl border border-border bg-card motion-safe:animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
