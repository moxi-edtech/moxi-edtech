import * as React from "react";

/**
 * Loading surfaces mirror the final settings layouts rather than showing a
 * detached spinner. Intentionally no fake academic or financial data.
 */
function Bone({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block rounded-xl bg-muted motion-safe:animate-pulse ${className}`} />;
}

function Card({ children }: { children: React.ReactNode }) {
  return <section aria-hidden="true" className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">{children}</section>;
}

function FieldBone({ labelWidth = "w-24" }: { labelWidth?: string }) {
  return (
    <div className="space-y-2">
      <Bone className={`h-3 ${labelWidth}`} />
      <Bone className="h-11 w-full" />
    </div>
  );
}

function Status({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="min-w-0">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Matches the three left-hand identity forms and subscription/brand aside. */
export function IdentitySettingsSkeleton() {
  return (
    <Status label="A carregar identidade da escola">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card>
            <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
              <Bone className="h-4 w-40" /><Bone className="h-6 w-24 rounded-full" />
            </div>
            <div className="space-y-4">
              {[0, 1, 2].map(i => <FieldBone key={i} />)}
            </div>
          </Card>
          <Card>
            <Bone className="mb-5 h-4 w-40" />
            <div className="space-y-4">
              <FieldBone /><div className="flex gap-2"><Bone className="h-9 w-28" /><Bone className="h-9 w-24" /></div><FieldBone />
            </div>
          </Card>
          <Card>
            <Bone className="mb-5 h-4 w-36" />
            <div className="space-y-4">{[0, 1, 2, 3, 4].map(i => <FieldBone key={i} />)}</div>
          </Card>
        </div>
        <aside className="space-y-4">
          <Card>
            <Bone className="mb-5 h-4 w-40" />
            {[0, 1, 2].map(i => <div key={i} className="mb-4 flex items-center justify-between gap-3"><Bone className="h-3 w-28" /><Bone className="h-5 w-20 rounded-full" /></div>)}
          </Card>
          <Card>
            <Bone className="mb-5 h-4 w-32" />
            {[0, 1, 2, 3].map(i => <div key={i} className="mb-3 flex justify-between gap-3"><Bone className="h-3 w-28" /><Bone className="h-3 w-16" /></div>)}
          </Card>
          <Card>
            <Bone className="mb-4 h-4 w-32" />
            <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30"><Bone className="h-28 w-28" /></div>
          </Card>
        </aside>
      </div>
    </Status>
  );
}

/** Mirrors vertically stacked course cards with header, details and actions. */
export function CoursesSettingsSkeleton() {
  return (
    <Status label="A carregar cursos e classes">
      <div className="grid grid-cols-1 gap-4">
        {[0, 1].map(i => (
          <Card key={i}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <Bone className="h-8 w-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Bone className="h-4 w-52 max-w-full" />
                  <Bone className="h-3 w-64 max-w-full" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Bone className="h-10 w-28" /><Bone className="h-10 w-28" /><Bone className="h-10 w-24" />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-4">
              <Bone className="h-3 w-36" /><Bone className="h-3 w-24" />
            </div>
          </Card>
        ))}
      </div>
    </Status>
  );
}

/** Matches formula, preview and the 3-column policy summary in read mode. */
export function EvaluationSettingsSkeleton() {
  return (
    <Status label="A carregar avaliação e frequência">
      <div className="space-y-6">
        <Card>
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><Bone className="h-10 w-10 rounded-full" /><div className="space-y-2"><Bone className="h-4 w-40" /><Bone className="h-3 w-28" /></div></div>
            <Bone className="h-6 w-20 rounded-full" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 rounded-xl border border-border bg-muted/30 p-6">
            <Bone className="h-10 w-24" /><Bone className="h-10 w-8" /><Bone className="h-10 w-24" />
          </div>
        </Card>
        <Card>
          <Bone className="mb-4 h-4 w-44" />
          <div className="overflow-hidden rounded-xl border border-border">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 border-b border-border p-3 last:border-0">
                <Bone className="h-3 min-w-0 flex-1" /><Bone className="h-3 w-14" /><Bone className="h-3 w-14" /><Bone className="h-3 w-14" />
              </div>
            ))}
          </div>
        </Card>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[0, 1, 2].map(i => <Card key={i}><div className="flex items-center gap-3"><Bone className="h-10 w-10 rounded-full" /><div className="min-w-0 flex-1 space-y-2"><Bone className="h-3 w-3/4" /><Bone className="h-6 w-1/2" /></div></div></Card>)}
          <div className="md:col-span-3"><Card><div className="flex items-start gap-4"><Bone className="h-10 w-10 rounded-full" /><div className="min-w-0 flex-1 space-y-2"><Bone className="h-3 w-36" /><Bone className="h-4 w-64 max-w-full" /><Bone className="h-3 w-3/4" /></div></div></Card></div>
        </div>
      </div>
    </Status>
  );
}

/** Matches calendar's year dates and trimester rows; events tab is a list. */
export function CalendarSettingsSkeleton({ tab = "trimestres" }: { tab?: "trimestres" | "eventos" }) {
  return (
    <Status label="A carregar calendário escolar">
      <div className="space-y-6">
        {tab === "trimestres" && (
          <Card>
            <Bone className="mb-5 h-4 w-60 max-w-full" />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2"><FieldBone /><FieldBone /></div>
          </Card>
        )}
        <Card>
          <div className="mb-5 flex items-center justify-between gap-3"><Bone className="h-4 w-52 max-w-full" /><Bone className="h-6 w-20 rounded-full" /></div>
          <div className="divide-y divide-border">
            {[0, 1, 2].map(i => (
              <div key={i} className="grid grid-cols-1 gap-3 py-5 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                <div className="space-y-2"><Bone className="h-3 w-24" /><Bone className="h-10 w-full" /></div>
                <div className="space-y-2"><Bone className="h-3 w-20" /><Bone className="h-10 w-full" /></div>
                <div className="space-y-2"><Bone className="h-3 w-24" /><Bone className="h-10 w-full" /></div>
                <Bone className="h-10 w-10" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Status>
  );
}
